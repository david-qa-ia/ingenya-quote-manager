import type { Activity } from '../types/activity';
import type { CadenceExecution } from '../types/cadence';
import type { Client } from '../types/client';
import type { FollowUpFilters, FollowUpInboxItem } from '../types/followUpInbox';
import type { Opportunity } from '../types/opportunity';
import type { SavedQuote } from '../types/quote';
import { isPendingEmail, isPendingPhone } from './clientValidation';
import { businessTimeZone, getActionBucket, priorityRank } from './opportunityNextAction';

export const defaultFollowUpFilters: FollowUpFilters = {
  bucket: 'all',
  responsible: 'all',
  channel: 'all',
  priority: 'all',
  search: '',
  nextSevenDays: false,
  sort: 'priority',
};

function localDay(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: businessTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function countReschedules(action: NonNullable<Opportunity['nextAction']>) {
  return action.history.filter((entry) => entry.event === 'rescheduled').length;
}
export function calculateFollowUpPriority(
  item: Pick<FollowUpInboxItem, 'bucket' | 'manualPriority' | 'source' | 'rescheduleCount'>,
  _context: unknown,
  _now = new Date(),
) {
  void _now;
  let score = 0;
  const reasons: string[] = [];
  if (item.bucket === 'overdue') {
    score += 1000;
    reasons.push('Acción vencida');
  } else if (item.bucket === 'today') score += 400;
  else if (item.bucket === 'upcoming') score += 100;
  if (item.manualPriority === 'high') {
    score += 300;
    reasons.push('Prioridad manual alta');
  }
  if (item.manualPriority === 'medium') score += 150;
  if (item.source === 'opportunityCadence' || item.source === 'quoteCadence') {
    score += 75;
    reasons.push('Cadencia activa');
  }
  if (item.rescheduleCount > 0) {
    score += Math.min(item.rescheduleCount, 5) * 25;
    reasons.push(
      `Reprogramada ${item.rescheduleCount} ${item.rescheduleCount === 1 ? 'vez' : 'veces'}`,
    );
  }
  if (item.bucket === 'missing') {
    score += 250;
    reasons.push('Sin próxima acción');
  }
  return {
    score,
    level: score >= 600 ? ('high' as const) : score >= 250 ? ('medium' as const) : ('low' as const),
    reasons,
  };
}

export function deriveFollowUpInbox(
  opportunities: readonly Opportunity[],
  clients: readonly Client[],
  quotes: readonly SavedQuote[],
  executions: readonly CadenceExecution[],
  _activities: readonly Activity[],
  now = new Date(),
): FollowUpInboxItem[] {
  const clientsById = new Map(clients.map((client) => [client.id, client]));
  const quoteById = new Map(quotes.map((quote) => [quote.id, quote]));
  const cadenceByActionId = new Map<
    string,
    { execution: CadenceExecution; current: number; total: number; stepId: string }
  >();
  for (const execution of executions) {
    if (execution.status !== 'active' || !execution.currentStepExecutionId) continue;
    const step = execution.stepExecutions.find(
      (item) => item.id === execution.currentStepExecutionId,
    );
    if (!step?.nextAction || step.nextAction.status !== 'pending') continue;
    cadenceByActionId.set(step.nextAction.id, {
      execution,
      current: execution.stepExecutions.length,
      total: execution.templateSnapshot.steps.filter((candidate) => candidate.status === 'active')
        .length,
      stepId: step.id,
    });
  }
  const items: FollowUpInboxItem[] = [];
  const seenCadences = new Set<string>();
  for (const opportunity of opportunities) {
    if ((opportunity.status ?? 'active') !== 'active') continue;
    const client = clientsById.get(opportunity.clientId);
    const action = opportunity.nextAction;
    if (action?.status === 'pending') {
      const cadence = cadenceByActionId.get(action.id);
      const bucket =
        getActionBucket(action, now) ??
        (Date.parse(action.dueAt) > now.getTime() ? 'upcoming' : null);
      if (!bucket) continue;
      if (cadence) seenCadences.add(cadence.execution.id);
      const base = {
        id: action.id,
        bucket,
        source: cadence ? ('opportunityCadence' as const) : ('manual' as const),
        action,
        clientId: client?.id,
        clientName: client?.name ?? 'Cliente no disponible',
        phone: client && !isPendingPhone(client.phone) ? client.phone : undefined,
        email: client && !isPendingEmail(client.email) ? client.email : undefined,
        contactRestricted: !!client?.doNotContact,
        opportunityId: opportunity.id,
        opportunityName: opportunity.name,
        responsible: action.responsible || opportunity.responsibleSeller || 'Sin asignar',
        channel: action.type,
        manualPriority: action.priority,
        cadenceStep: cadence
          ? {
              current: cadence.current,
              total: cadence.total,
              executionId: cadence.execution.id,
              stepExecutionId: cadence.stepId,
            }
          : undefined,
        rescheduleCount: countReschedules(action),
      };
      items.push({ ...base, priority: calculateFollowUpPriority(base, null, now) });
    } else {
      const base = {
        id: `missing:${opportunity.id}`,
        bucket: 'missing' as const,
        source: 'missing' as const,
        clientId: client?.id,
        clientName: client?.name ?? 'Cliente no disponible',
        phone: client && !isPendingPhone(client.phone) ? client.phone : undefined,
        email: client && !isPendingEmail(client.email) ? client.email : undefined,
        contactRestricted: !!client?.doNotContact,
        opportunityId: opportunity.id,
        opportunityName: opportunity.name,
        responsible: opportunity.responsibleSeller || 'Sin asignar',
        rescheduleCount: 0,
      };
      items.push({ ...base, priority: calculateFollowUpPriority(base, null, now) });
    }
  }
  for (const cadence of cadenceByActionId.values()) {
    const execution = cadence.execution;
    if (execution.target.kind !== 'sentQuote' || seenCadences.has(execution.id)) continue;
    const quote = quoteById.get(execution.target.quoteId);
    const action = execution.stepExecutions.find((item) => item.id === cadence.stepId)?.nextAction;
    if (!action || !quote || !['sent', 'followingUp'].includes(quote.commercialStatus)) continue;
    const client = quote.clientId ? clientsById.get(quote.clientId) : undefined;
    const bucket =
      getActionBucket(action, now) ??
      (Date.parse(action.dueAt) > now.getTime() ? 'upcoming' : null);
    if (!bucket) continue;
    const base = {
      id: `cadence:${execution.id}:${cadence.stepId}`,
      bucket,
      source: 'quoteCadence' as const,
      action,
      clientId: client?.id,
      clientName: (client?.name ?? quote.clientName) || 'Cliente no disponible',
      phone: client && !isPendingPhone(client.phone) ? client.phone : undefined,
      email: client && !isPendingEmail(client.email) ? client.email : undefined,
      contactRestricted: !!client?.doNotContact,
      opportunityId: quote.opportunityId,
      opportunityName: opportunities.find((item) => item.id === quote.opportunityId)?.name,
      quoteId: quote.id,
      quoteName: quote.projectName || quote.id,
      responsible: action.responsible || 'Sin asignar',
      channel: action.type,
      manualPriority: action.priority,
      cadenceStep: {
        current: cadence.current,
        total: cadence.total,
        executionId: execution.id,
        stepExecutionId: cadence.stepId,
      },
      rescheduleCount: countReschedules(action),
    };
    items.push({ ...base, priority: calculateFollowUpPriority(base, null, now) });
  }
  return items;
}
export function filterFollowUpInbox(
  items: readonly FollowUpInboxItem[],
  filters: FollowUpFilters,
  now = new Date(),
) {
  const query = filters.search.trim().toLocaleLowerCase('es');
  const limit = now.getTime() + 7 * 86400000;
  return items
    .filter(
      (item) =>
        (filters.bucket === 'all' || item.bucket === filters.bucket) &&
        (filters.responsible === 'all' || item.responsible === filters.responsible) &&
        (filters.channel === 'all' || item.channel === filters.channel) &&
        (filters.priority === 'all' || item.priority.level === filters.priority) &&
        (!filters.nextSevenDays ||
          (!!item.action && item.action.dueAt <= new Date(limit).toISOString())) &&
        (!query ||
          `${item.clientName} ${item.opportunityName ?? ''} ${item.quoteName ?? ''}`
            .toLocaleLowerCase('es')
            .includes(query)),
    )
    .slice()
    .sort((a, b) => {
      const primary =
        filters.sort === 'priority'
          ? b.priority.score - a.priority.score
          : Date.parse(a.action?.dueAt ?? '9999-12-31') -
            Date.parse(b.action?.dueAt ?? '9999-12-31');
      return (
        primary ||
        Date.parse(a.action?.dueAt ?? '9999-12-31') - Date.parse(b.action?.dueAt ?? '9999-12-31') ||
        priorityRank[a.manualPriority ?? 'low'] - priorityRank[b.manualPriority ?? 'low'] ||
        a.clientName.localeCompare(b.clientName, 'es')
      );
    });
}
export { localDay };
