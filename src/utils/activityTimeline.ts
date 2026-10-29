import type { Activity, ActivitySubject, ActivityType, CallResult } from '../types/activity';

export type ActivityFilter = 'all' | ActivityType;

export interface TimelineSubject {
  subject: ActivitySubject;
  label: 'Presupuesto' | 'Cliente' | 'Obra o trabajo';
}

function hasSubject(activity: Activity, subject: ActivitySubject): boolean {
  if (subject.kind === 'client')
    return activity.subject.kind === 'client' && activity.subject.clientId === subject.clientId;
  if (subject.kind === 'opportunity')
    return (
      activity.subject.kind === 'opportunity' &&
      activity.subject.opportunityId === subject.opportunityId
    );
  return activity.subject.kind === 'quote' && activity.subject.quoteId === subject.quoteId;
}

export function getTimelineActivities(
  activities: readonly Activity[],
  subject: ActivitySubject,
  filter: ActivityFilter,
): Activity[] {
  return activities
    .filter((activity) => hasSubject(activity, subject))
    .filter((activity) => filter === 'all' || activity.type === filter)
    .sort((first, second) => {
      const difference = Date.parse(second.occurredAt) - Date.parse(first.occurredAt);
      return difference || second.id.localeCompare(first.id);
    });
}

export function getTimelineActivitiesForSubjects(
  activities: readonly Activity[],
  subjects: readonly ActivitySubject[],
  filter: ActivityFilter,
): Activity[] {
  return activities
    .filter((activity) => subjects.some((subject) => hasSubject(activity, subject)))
    .filter((activity) => filter === 'all' || activity.type === filter)
    .sort((first, second) => {
      const difference = Date.parse(second.occurredAt) - Date.parse(first.occurredAt);
      return difference || second.id.localeCompare(first.id);
    });
}

export function getTimelineSubjectLabel(
  activity: Activity,
  subjects: readonly TimelineSubject[],
): TimelineSubject['label'] {
  return subjects.find(({ subject }) => hasSubject(activity, subject))?.label ?? 'Presupuesto';
}

const callResultLabels: Record<CallResult, string> = {
  effectiveContact: 'Contacto efectivo',
  noAnswer: 'No contesta',
  callBack: 'Volver a llamar',
  notInterested: 'No interesado',
  invalidNumber: 'Número inválido',
};

/** Human-readable result for compact activity lists; never exposes internal result codes. */
export function getActivityResultLabel(activity: Activity): string {
  if (activity.type === 'call' && activity.result in callResultLabels)
    return callResultLabels[activity.result as CallResult];
  return activity.result;
}

const activityDateTimeFormatter = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Date and time in 24-hour Argentina format, e.g. "28/10/2026, 21:17". */
export function formatActivityDateTime(iso: string): string {
  return activityDateTimeFormatter.format(new Date(iso));
}
