import type { Activity } from '../types/activity';
import type {
  CommercialMetrics,
  CommercialMetricsFilters,
  CommercialMetricsSources,
  MetricValue,
} from '../types/commercialMetrics';
import type { CommercialReasonCode } from '../types/commercialOutcome';
import { businessTimeZone, isOverdue } from './opportunityNextAction';

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

function activityBelongs(activity: Activity, opportunityIds: Set<string>, quoteIds: Set<string>) {
  return (
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
  now = new Date(),
): CommercialMetrics {
  const clients = new Map(sources.clients.map((item) => [item.id, item]));
  let opportunities = sources.opportunities.filter(
    (item) =>
      (filters.responsible === 'all' || item.responsibleSeller === filters.responsible) &&
      (filters.commercialState === 'all' ||
        (item.commercialState ?? 'open') === filters.commercialState) &&
      (filters.clientId === 'all' || item.clientId === filters.clientId) &&
      (filters.opportunityId === 'all' || item.id === filters.opportunityId),
  );
  const opportunityIds = new Set(opportunities.map((item) => item.id));
  let quotes = sources.quotes.filter((item) => opportunityIds.has(item.opportunityId ?? ''));
  if (filters.quoteId !== 'all') quotes = quotes.filter((item) => item.id === filters.quoteId);
  if (filters.service !== 'all')
    quotes = quotes.filter((item) => item.lines.some((line) => line.name === filters.service));
  if (filters.quoteId !== 'all' || filters.service !== 'all') {
    const quoteOpportunityIds = new Set(quotes.map((item) => item.opportunityId).filter(Boolean));
    opportunities = opportunities.filter((item) => quoteOpportunityIds.has(item.id));
  }
  const scopedOpportunityIds = new Set(opportunities.map((item) => item.id));
  const quoteIds = new Set(quotes.map((item) => item.id));
  const outcomes = sources.outcomes.filter(
    (item) =>
      scopedOpportunityIds.has(item.opportunityId) &&
      (filters.quoteId === 'all' || item.quoteId === filters.quoteId) &&
      (filters.reason === 'all' || item.reasonCode === filters.reason),
  );
  const activities = sources.activities.filter(
    (item) =>
      activityBelongs(item, scopedOpportunityIds, quoteIds) &&
      (filters.channel === 'all' || item.type === filters.channel),
  );
  const previous = previousRange(filters);
  const prior = (date: string) =>
    previous !== null &&
    Date.parse(date) >= Date.parse(previous.start) &&
    Date.parse(date) < Date.parse(previous.end);
  const current = (date: string) => inRange(date, filters);
  const outcomesOf = (type: string, predicate = current) =>
    outcomes.filter((item) => item.type === type && predicate(item.occurredAt)).length;
  const actionKeys = new Set<string>();
  let completed = 0,
    overdue = 0,
    rescheduled = 0;
  for (const opportunity of opportunities) {
    const action = opportunity.nextAction;
    if (
      !action ||
      (filters.responsible !== 'all' && action.responsible !== filters.responsible) ||
      (filters.channel !== 'all' && action.type !== filters.channel)
    )
      continue;
    actionKeys.add(action.id);
    if (action.history.some((entry) => entry.event === 'completed' && current(entry.occurredAt)))
      completed++;
    rescheduled += action.history.filter(
      (entry) => entry.event === 'rescheduled' && current(entry.occurredAt),
    ).length;
    if (isOverdue(action, now)) overdue++;
  }
  for (const execution of sources.executions)
    for (const step of execution.stepExecutions) {
      const action = step.nextAction;
      if (!action || actionKeys.has(action.id)) continue;
      const targetMatches =
        execution.target.kind === 'opportunity'
          ? scopedOpportunityIds.has(execution.target.opportunityId)
          : quoteIds.has(execution.target.quoteId);
      if (
        !targetMatches ||
        (filters.responsible !== 'all' && action.responsible !== filters.responsible) ||
        (filters.channel !== 'all' && action.type !== filters.channel)
      )
        continue;
      actionKeys.add(action.id);
      if (step.completedAt && current(step.completedAt)) completed++;
      rescheduled += action.history.filter(
        (entry) => entry.event === 'rescheduled' && current(entry.occurredAt),
      ).length;
      if (isOverdue(action, now)) overdue++;
    }
  const contactHours = opportunities.flatMap((opportunity) => {
    const first = activities
      .filter(
        (item) =>
          activityBelongs(item, new Set([opportunity.id]), quoteIds) &&
          item.source === 'manual' &&
          ['call', 'whatsapp', 'email'].includes(item.type),
      )
      .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))[0];
    return first
      ? [(Date.parse(first.occurredAt) - Date.parse(opportunity.createdAt)) / 3600000]
      : [];
  });
  const resultHours = opportunities.flatMap((opportunity) => {
    const result = outcomes
      .filter(
        (item) =>
          item.opportunityId === opportunity.id &&
          ['accepted', 'rejected', 'lost'].includes(item.type),
      )
      .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))[0];
    return result
      ? [(Date.parse(result.occurredAt) - Date.parse(opportunity.createdAt)) / 3600000]
      : [];
  });
  const average = (values: number[]) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const days = new Map<
    string,
    {
      day: string;
      label: string;
      created: number;
      sent: number;
      accepted: number;
      rejected: number;
      lost: number;
    }
  >();
  const add = (value: string, key: 'created' | 'sent' | 'accepted' | 'rejected' | 'lost') => {
    if (!current(value)) return;
    const keyDay = day(value);
    const row = days.get(keyDay) ?? {
      day: keyDay,
      label: displayDayFormatter.format(new Date(value)),
      created: 0,
      sent: 0,
      accepted: 0,
      rejected: 0,
      lost: 0,
    };
    row[key]++;
    days.set(keyDay, row);
  };
  opportunities.forEach((item) => add(item.createdAt, 'created'));
  quotes.forEach((item) => item.sentAudit && add(item.sentAudit.changedAt, 'sent'));
  outcomes.forEach((item) => {
    if (item.type === 'accepted' || item.type === 'rejected' || item.type === 'lost')
      add(item.occurredAt, item.type);
  });
  const reasons = new Map<string, number>();
  outcomes
    .filter((item) => current(item.occurredAt) && item.reasonCode)
    .forEach((item) => reasons.set(item.reasonCode!, (reasons.get(item.reasonCode!) ?? 0) + 1));
  const definitive = opportunities.filter((item) =>
    ['won', 'lost'].includes(item.commercialState ?? 'open'),
  ).length;
  const won = opportunities.filter((item) => item.commercialState === 'won').length;
  const accepted = outcomesOf('accepted');
  const sent = quotes.filter((item) => item.sentAudit && current(item.sentAudit.changedAt)).length;
  const kpis = {
    opportunitiesCreated: metric(
      opportunities.filter((item) => current(item.createdAt)).length,
      opportunities.filter((item) => prior(item.createdAt)).length,
    ),
    quotesSent: metric(
      sent,
      quotes.filter((item) => item.sentAudit && prior(item.sentAudit.changedAt)).length,
    ),
    quotesAccepted: metric(accepted, outcomesOf('accepted', prior)),
    quotesRejected: metric(outcomesOf('rejected'), outcomesOf('rejected', prior)),
    opportunitiesLost: metric(outcomesOf('lost'), outcomesOf('lost', prior)),
    opportunitiesReopened: metric(outcomesOf('reopened'), outcomesOf('reopened', prior)),
    followUpsCompleted: metric(completed, 0),
    followUpsOverdue: metric(overdue, 0),
    followUpsRescheduled: metric(rescheduled, 0),
  };
  const partialCoverage =
    sources.issues.some(Boolean) ||
    opportunities.some((item) => !clients.has(item.clientId)) ||
    quotes.some((item) => item.opportunityId && !scopedOpportunityIds.has(item.opportunityId));
  return {
    kpis,
    opportunityConversion: {
      numerator: won,
      denominator: definitive,
      rate: definitive ? (won / definitive) * 100 : null,
    },
    quoteConversion: {
      numerator: accepted,
      denominator: sent,
      rate: sent ? (accepted / sent) * 100 : null,
    },
    reasons: [...reasons]
      .map(([code, count]) => ({ code: code as CommercialReasonCode, count }))
      .sort((a, b) => b.count - a.count),
    trend: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)),
    effectiveness: [{ label: 'Seguimiento', completed, overdue, rescheduled }],
    averageFirstContactHours: average(contactHours),
    averageResultHours: average(resultHours),
    hasAmbiguousCorrections: outcomes.some((item) => item.type === 'corrected'),
    partialCoverage,
    empty: opportunities.length === 0 && quotes.length === 0 && outcomes.length === 0,
  };
}
