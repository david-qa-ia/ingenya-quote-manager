import type { Activity } from '../types/activity';
import type {
  CommercialMetrics,
  CommercialMetricsFilters,
  CommercialMetricsSources,
  MetricValue,
} from '../types/commercialMetrics';
import { businessTimeZone } from './opportunityNextAction';
import type { Prospect } from '../types/prospect';
import { isProspectSystemNote } from './prospectWorkflow';

/** Prefix used in the client filter to select a prospect instead of a client. */
export const PROSPECT_FILTER_PREFIX = 'prospect:';

/** Spanish labels for the channel filter; values stay as stored internally. */
export const commercialChannelLabels: Record<string, string> = {
  call: 'Llamada',
  whatsapp: 'WhatsApp',
  email: 'Email',
  instagram: 'Instagram',
  meeting: 'Reunión',
  note: 'Nota',
  relevantChange: 'Cambio relevante',
  waitForResponse: 'Esperar respuesta',
  other: 'Otro',
};

export function getCommercialChannelLabel(channel: string): string {
  return commercialChannelLabels[channel] ?? channel;
}

interface MetricEvent {
  type: string;
  occurredAt: string;
  author: string;
  isContact: boolean;
  isEffective: boolean;
  isNote: boolean;
}

interface ProspectFollowUpEvent {
  event: 'completed' | 'rescheduled';
  occurredAt: string;
  actor: string;
  type: string;
}

const prospectChannelToMetricType = {
  phone: 'call',
  whatsapp: 'whatsapp',
  email: 'email',
  instagram: 'instagram',
} as const;

function prospectInScope(prospect: Prospect, filters: CommercialMetricsFilters): boolean {
  if (filters.quoteId !== 'all') return false;
  const draft = prospect.conversion?.state === 'completed' ? prospect.conversion.draft : undefined;
  if (filters.clientId.startsWith(PROSPECT_FILTER_PREFIX))
    return (
      filters.clientId === `${PROSPECT_FILTER_PREFIX}${prospect.id}` &&
      filters.opportunityId === 'all'
    );
  if (filters.clientId !== 'all' && draft?.clientId !== filters.clientId) return false;
  if (filters.opportunityId !== 'all' && draft?.opportunityId !== filters.opportunityId)
    return false;
  return true;
}

/** Manual prospect activity as metric events; profile edits are traceability, not contacts. */
function getProspectMetricEvents(
  prospects: readonly Prospect[],
  filters: CommercialMetricsFilters,
): { events: MetricEvent[]; followUps: ProspectFollowUpEvent[] } {
  const events: MetricEvent[] = [];
  const followUps: ProspectFollowUpEvent[] = [];
  for (const prospect of prospects) {
    if (!prospectInScope(prospect, filters)) continue;
    for (const activity of prospect.activities) {
      const author = activity.author ?? '';
      if (activity.type === 'contactResult' && activity.channel) {
        const type = prospectChannelToMetricType[activity.channel];
        events.push({
          type,
          occurredAt: activity.occurredAt,
          author,
          isContact: true,
          isEffective: activity.result === 'contacted',
          isNote: false,
        });
        if (activity.previousFollowUpAt)
          followUps.push({
            event: activity.followUpAt ? 'rescheduled' : 'completed',
            occurredAt: activity.occurredAt,
            actor: author,
            type,
          });
      } else if (activity.type === 'note' && !isProspectSystemNote(activity.description)) {
        events.push({
          type: 'note',
          occurredAt: activity.occurredAt,
          author,
          isContact: false,
          isEffective: false,
          isNote: true,
        });
      }
    }
  }
  return { events, followUps };
}

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: businessTimeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const displayDayFormatter = new Intl.DateTimeFormat('es-AR', {
  timeZone: businessTimeZone,
  day: '2-digit',
  month: 'short',
});
const day = (value: string | Date) => dayFormatter.format(new Date(value));
const startOf = (date: string) => new Date(`${date}T00:00:00-03:00`).getTime();
const endOf = (date: string) => new Date(`${date}T00:00:00-03:00`).getTime() + 86400000;
const inRange = (value: string, filters: CommercialMetricsFilters) =>
  (!filters.startDate || Date.parse(value) >= startOf(filters.startDate)) &&
  (!filters.endDate || Date.parse(value) < endOf(filters.endDate));
const previousRange = (filters: CommercialMetricsFilters) => {
  if (!filters.startDate || !filters.endDate) return null;
  const length = endOf(filters.endDate) - startOf(filters.startDate);
  return {
    start: new Date(startOf(filters.startDate) - length).toISOString(),
    end: new Date(startOf(filters.startDate)).toISOString(),
  };
};
const metric = (value: number, previous: number): MetricValue => ({
  value,
  previous,
  comparison: previous === 0 ? null : ((value - previous) / previous) * 100,
});
type TrendEntry = CommercialMetrics['trend'][number];

function activityBelongs(
  activity: Activity,
  clientIds: Set<string>,
  opportunityIds: Set<string>,
  quoteIds: Set<string>,
) {
  return (
    (activity.subject.kind === 'client' && clientIds.has(activity.subject.clientId)) ||
    (activity.subject.kind === 'opportunity' &&
      opportunityIds.has(activity.subject.opportunityId)) ||
    (activity.subject.kind === 'quote' && quoteIds.has(activity.subject.quoteId))
  );
}

export function getArgentinaToday(now = new Date()) {
  return day(now);
}
export function getPreviousPeriod(filters: CommercialMetricsFilters) {
  return previousRange(filters);
}

export function calculateCommercialMetrics(
  sources: CommercialMetricsSources,
  filters: CommercialMetricsFilters,
): CommercialMetrics {
  const clients = new Map(sources.clients.map((item) => [item.id, item]));
  const clientIds = new Set(
    sources.clients
      .filter((item) => filters.clientId === 'all' || item.id === filters.clientId)
      .map((item) => item.id),
  );
  let opportunities = sources.opportunities.filter(
    (item) =>
      (filters.clientId === 'all' || item.clientId === filters.clientId) &&
      (filters.opportunityId === 'all' || item.id === filters.opportunityId),
  );
  let quotes = sources.quotes.filter(
    (item) =>
      (filters.clientId === 'all' || item.clientId === filters.clientId) &&
      (filters.opportunityId === 'all' || item.opportunityId === filters.opportunityId),
  );
  if (filters.quoteId !== 'all') quotes = quotes.filter((item) => item.id === filters.quoteId);
  if (filters.quoteId !== 'all') {
    const quoteOpportunityIds = new Set(quotes.map((item) => item.opportunityId).filter(Boolean));
    opportunities = opportunities.filter((item) => quoteOpportunityIds.has(item.id));
  }
  const scopedOpportunityIds = new Set(opportunities.map((item) => item.id));
  const quoteIds = new Set(quotes.map((item) => item.id));
  const channelMatches = (type: string) => filters.channel === 'all' || type === filters.channel;
  const responsibleMatches = (author: string) =>
    filters.responsible === 'all' || author === filters.responsible;
  // A quote send is recorded as an activity with result "sent": it counts as activity and as
  // "Presupuestos enviados", but not as a contact or a note (SCRUM-105).
  const activityEvents: MetricEvent[] = sources.activities
    .filter(
      (item) =>
        activityBelongs(item, clientIds, scopedOpportunityIds, quoteIds) &&
        item.source === 'manual' &&
        channelMatches(item.type) &&
        responsibleMatches(item.author),
    )
    .map((item) => {
      const isSend = item.result === 'sent';
      const isContact = !isSend && ['call', 'whatsapp', 'email'].includes(item.type);
      return {
        type: item.type,
        occurredAt: item.occurredAt,
        author: item.author,
        isContact,
        isEffective: isContact && ['effectiveContact', 'responseReceived'].includes(item.result),
        isNote: !isSend && item.type === 'note',
      };
    });
  const prospectMetrics = getProspectMetricEvents(sources.prospects ?? [], filters);
  const activities = [
    ...activityEvents,
    ...prospectMetrics.events.filter(
      (item) => channelMatches(item.type) && responsibleMatches(item.author),
    ),
  ];
  const previous = previousRange(filters);
  const prior = (date: string) =>
    previous !== null &&
    Date.parse(date) >= Date.parse(previous.start) &&
    Date.parse(date) < Date.parse(previous.end);
  const current = (date: string) => inRange(date, filters);
  const actionKeys = new Set<string>();
  let completed = 0;
  let completedPrevious = 0;
  let rescheduled = 0;
  let rescheduledPrevious = 0;
  for (const opportunity of opportunities) {
    const action = opportunity.nextAction;
    if (!action || (filters.channel !== 'all' && action.type !== filters.channel)) continue;
    actionKeys.add(action.id);
    action.history.forEach((entry) => {
      if (filters.responsible !== 'all' && entry.actor !== filters.responsible) return;
      if (entry.event === 'completed' && current(entry.occurredAt)) completed++;
      if (entry.event === 'completed' && prior(entry.occurredAt)) completedPrevious++;
      if (entry.event === 'rescheduled' && current(entry.occurredAt)) rescheduled++;
      if (entry.event === 'rescheduled' && prior(entry.occurredAt)) rescheduledPrevious++;
    });
  }
  for (const execution of sources.executions)
    for (const step of execution.stepExecutions) {
      const action = step.nextAction;
      if (!action || actionKeys.has(action.id)) continue;
      const targetMatches =
        execution.target.kind === 'opportunity'
          ? scopedOpportunityIds.has(execution.target.opportunityId)
          : quoteIds.has(execution.target.quoteId);
      if (!targetMatches || (filters.channel !== 'all' && action.type !== filters.channel))
        continue;
      actionKeys.add(action.id);
      if (
        step.completedAt &&
        (filters.responsible === 'all' || action.responsible === filters.responsible)
      ) {
        if (current(step.completedAt)) completed++;
        if (prior(step.completedAt)) completedPrevious++;
      }
      action.history.forEach((entry) => {
        if (filters.responsible !== 'all' && entry.actor !== filters.responsible) return;
        if (entry.event === 'rescheduled' && current(entry.occurredAt)) rescheduled++;
        if (entry.event === 'rescheduled' && prior(entry.occurredAt)) rescheduledPrevious++;
      });
    }
  for (const entry of prospectMetrics.followUps) {
    if (!channelMatches(entry.type) || !responsibleMatches(entry.actor)) continue;
    if (entry.event === 'completed' && current(entry.occurredAt)) completed++;
    if (entry.event === 'completed' && prior(entry.occurredAt)) completedPrevious++;
    if (entry.event === 'rescheduled' && current(entry.occurredAt)) rescheduled++;
    if (entry.event === 'rescheduled' && prior(entry.occurredAt)) rescheduledPrevious++;
  }
  const days = new Map<string, TrendEntry>();
  const add = (
    value: string,
    values: Partial<
      Pick<TrendEntry, 'activities' | 'contacts' | 'effectiveContacts' | 'notes' | 'sent'>
    >,
  ) => {
    if (!current(value)) return;
    const keyDay = day(value);
    const row = days.get(keyDay) ?? {
      day: keyDay,
      label: displayDayFormatter.format(new Date(value)),
      activities: 0,
      contacts: 0,
      effectiveContacts: 0,
      notes: 0,
      sent: 0,
    };
    row.activities += values.activities ?? 0;
    row.contacts += values.contacts ?? 0;
    row.effectiveContacts += values.effectiveContacts ?? 0;
    row.notes += values.notes ?? 0;
    row.sent += values.sent ?? 0;
    days.set(keyDay, row);
  };
  const contacts = activities.filter((item) => item.isContact);
  const effectiveContacts = contacts.filter((item) => item.isEffective);
  const notes = activities.filter((item) => item.isNote);
  activities.forEach((item) => {
    add(item.occurredAt, {
      activities: 1,
      contacts: item.isContact ? 1 : 0,
      effectiveContacts: item.isEffective ? 1 : 0,
      notes: item.isNote ? 1 : 0,
    });
  });
  // Sends without a channel were registered as a note.
  const quoteSends = quotes.filter(
    (item) =>
      item.sentAudit &&
      channelMatches(item.sentAudit.channel ?? 'note') &&
      responsibleMatches(item.sentAudit.changedBy),
  );
  quoteSends.forEach((item) => item.sentAudit && add(item.sentAudit.changedAt, { sent: 1 }));
  const kpis = {
    activitiesRegistered: metric(
      activities.filter((item) => current(item.occurredAt)).length,
      activities.filter((item) => prior(item.occurredAt)).length,
    ),
    contactsRegistered: metric(
      contacts.filter((item) => current(item.occurredAt)).length,
      contacts.filter((item) => prior(item.occurredAt)).length,
    ),
    effectiveContacts: metric(
      effectiveContacts.filter((item) => current(item.occurredAt)).length,
      effectiveContacts.filter((item) => prior(item.occurredAt)).length,
    ),
    notesAdded: metric(
      notes.filter((item) => current(item.occurredAt)).length,
      notes.filter((item) => prior(item.occurredAt)).length,
    ),
    quotesSent: metric(
      quoteSends.filter((item) => item.sentAudit && current(item.sentAudit.changedAt)).length,
      quoteSends.filter((item) => item.sentAudit && prior(item.sentAudit.changedAt)).length,
    ),
    followUpsCompleted: metric(completed, completedPrevious),
    followUpsRescheduled: metric(rescheduled, rescheduledPrevious),
  };
  const partialCoverage =
    sources.issues.some(Boolean) ||
    opportunities.some((item) => !clients.has(item.clientId)) ||
    quotes.some((item) => item.opportunityId && !scopedOpportunityIds.has(item.opportunityId));
  const currentContacts = contacts.filter((item) => current(item.occurredAt)).length;
  const currentEffectiveContacts = effectiveContacts.filter((item) =>
    current(item.occurredAt),
  ).length;
  const focus =
    currentContacts === 0
      ? 'registerContact'
      : currentEffectiveContacts === 0
        ? 'followUpContacts'
        : completed === 0
          ? 'defineNextStep'
          : 'keepMomentum';
  return {
    kpis,
    trend: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)),
    activityBreakdown: [
      ...(
        [
          ['Llamadas', 'call'],
          ['WhatsApp', 'whatsapp'],
          ['Emails', 'email'],
          ['Instagram', 'instagram'],
        ] as const
      )
        .map(([label, type]) => ({
          label,
          count: contacts.filter((item) => item.type === type && current(item.occurredAt)).length,
        }))
        // Instagram only exists for prospects; show it only when it has activity.
        .filter((item) => item.label !== 'Instagram' || item.count > 0),
      { label: 'Notas', count: notes.filter((item) => current(item.occurredAt)).length },
    ],
    followUpActions: { completed, rescheduled },
    contactEffectiveness: { effective: currentEffectiveContacts, registered: currentContacts },
    focus,
    partialCoverage,
    empty: Object.values(kpis).every((item) => item.value === 0),
  };
}
