import type { Activity, ActivitySubject, ActivityType } from '../types/activity';

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
