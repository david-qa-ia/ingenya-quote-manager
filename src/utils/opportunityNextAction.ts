import type { NextAction, NextActionHistoryEvent, Opportunity } from '../types/opportunity';

export const businessTimeZone = 'America/Argentina/Buenos_Aires';
export const priorityRank = { high: 0, medium: 1, low: 2 } as const;

export function isOverdue(action: NextAction, now = new Date()): boolean {
  return action.status === 'pending' && Date.parse(action.dueAt) < now.getTime();
}
export function getActionBucket(
  action: NextAction,
  now = new Date(),
): 'overdue' | 'today' | 'upcoming' | null {
  if (action.status !== 'pending') return null;
  if (isOverdue(action, now)) return 'overdue';
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: businessTimeZone }).format(now);
  const dueDay = new Intl.DateTimeFormat('en-CA', { timeZone: businessTimeZone }).format(
    new Date(action.dueAt),
  );
  if (dueDay === day) return 'today';
  const sevenDays = now.getTime() + 7 * 24 * 60 * 60 * 1000;
  return Date.parse(action.dueAt) <= sevenDays ? 'upcoming' : null;
}
export function sortOpportunitiesByAction(
  opportunities: readonly Opportunity[],
  now = new Date(),
): Opportunity[] {
  return opportunities.slice().sort((first, second) => {
    const firstOverdue = first.nextAction && isOverdue(first.nextAction, now) ? 0 : 1;
    const secondOverdue = second.nextAction && isOverdue(second.nextAction, now) ? 0 : 1;
    const due =
      firstOverdue - secondOverdue ||
      Date.parse(first.nextAction?.dueAt ?? '9999-12-31') -
        Date.parse(second.nextAction?.dueAt ?? '9999-12-31');
    return (
      due ||
      (first.nextAction && second.nextAction
        ? priorityRank[first.nextAction.priority] - priorityRank[second.nextAction.priority]
        : 0) ||
      first.name.localeCompare(second.name, 'es')
    );
  });
}
export function transitionNextAction(
  opportunity: Opportunity,
  event: Exclude<NextActionHistoryEvent, 'created'>,
  actor: string,
  reason: string,
  now: string,
  options: { dueAt?: string; result?: string } = {},
): Opportunity {
  const action = opportunity.nextAction;
  if (!action || action.status !== 'pending')
    throw new Error('No hay una próxima acción pendiente.');
  if (!actor.trim() || !reason.trim()) throw new Error('Ingresá responsable y motivo.');
  if (event === 'completed' && !options.result?.trim())
    throw new Error('Ingresá el resultado de la acción.');
  if (event === 'rescheduled' && (!options.dueAt || !Number.isFinite(Date.parse(options.dueAt))))
    throw new Error('Ingresá una fecha y hora válida.');
  const status =
    event === 'rescheduled'
      ? 'pending'
      : event === 'completed'
        ? 'completed'
        : event === 'cancelled'
          ? 'cancelled'
          : 'notRelevant';
  const history = {
    id: `${action.id}:${event}:${now}`,
    occurredAt: now,
    actor: actor.trim(),
    event,
    reason: reason.trim(),
    ...(event === 'rescheduled' ? { previousDueAt: action.dueAt } : {}),
    ...(options.result?.trim() ? { result: options.result.trim() } : {}),
  } as const;
  return {
    ...opportunity,
    nextAction: {
      ...action,
      ...(event === 'rescheduled' ? { dueAt: options.dueAt! } : {}),
      status,
      updatedAt: now,
      history: [...action.history, history],
    },
    ...(status === 'pending' ? {} : { noNextActionException: undefined }),
    updatedAt: now,
  };
}
