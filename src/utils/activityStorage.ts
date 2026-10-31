import type {
  Activity,
  ActivityNoteRevision,
  ActivitySubject,
  ActivityType,
  AutomaticActivityEvent,
  CallResult,
} from '../types/activity';
import type { ContactCommunicationSnapshot, WhatsAppResult } from '../types/contactScript';
import { hasRecordId, loadCollection, readCollection } from './localCollectionStorage';
import { workspaceStorageKey } from './workspaceStorage';
import { emitLocalWrite } from './localWriteEvents';

export const ACTIVITIES_STORAGE_KEY = 'ingenya.activities.v1';
export const ACTIVITY_AUTHOR_STORAGE_KEY = 'ingenya.activityAuthor.v1';

function notifyActivityChange(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('activitiesupdated'));
}

const activityTypes: ActivityType[] = ['call', 'whatsapp', 'email', 'note', 'relevantChange'];
const callResults: CallResult[] = [
  'effectiveContact',
  'noAnswer',
  'callBack',
  'notInterested',
  'invalidNumber',
];
const whatsappResults: WhatsAppResult[] = [
  'messagePrepared',
  'messageCopied',
  'responseReceived',
  'noResponse',
  'invalidNumber',
  'notInterested',
];
const automaticEvents: AutomaticActivityEvent[] = [
  'created',
  'finalized',
  'pdfGenerated',
  'commercialStatusChanged',
  'nextActionChanged',
  'cadenceChanged',
  'commercialOutcomeChanged',
];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isSubject(value: unknown): value is ActivitySubject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const subject = value as Record<string, unknown>;
  return (
    (subject.kind === 'client' && isNonEmptyString(subject.clientId)) ||
    (subject.kind === 'opportunity' && isNonEmptyString(subject.opportunityId)) ||
    (subject.kind === 'quote' && isNonEmptyString(subject.quoteId))
  );
}

function isNoteRevision(value: unknown): value is ActivityNoteRevision {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const revision = value as Record<string, unknown>;
  return (
    isIsoDate(revision.editedAt) &&
    isNonEmptyString(revision.editedBy) &&
    typeof revision.note === 'string'
  );
}
function isCommunication(value: unknown): value is ContactCommunicationSnapshot {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const origin = item.origin as Record<string, unknown> | undefined;
  return (
    (item.channel === 'call' || item.channel === 'whatsapp') &&
    typeof item.preparedContent === 'string' &&
    typeof item.finalContent === 'string' &&
    (item.copyState === 'copied' || item.copyState === 'notCopied') &&
    (item.templateId === undefined || isNonEmptyString(item.templateId)) &&
    (item.templateName === undefined || isNonEmptyString(item.templateName)) &&
    (item.templateVersion === undefined ||
      (Number.isInteger(item.templateVersion) && (item.templateVersion as number) > 0)) &&
    !!origin &&
    (origin.kind === 'manual' ||
      (origin.kind === 'cadence' &&
        isNonEmptyString(origin.cadenceExecutionId) &&
        isNonEmptyString(origin.stepExecutionId) &&
        isNonEmptyString(origin.templateStepId)))
  );
}

export function isActivity(value: unknown): value is Activity {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const activity = value as Record<string, unknown>;
  const hasValidResult =
    isNonEmptyString(activity.result) &&
    (activity.type !== 'call' || callResults.includes(activity.result as CallResult)) &&
    (activity.type !== 'whatsapp' ||
      activity.communication === undefined ||
      whatsappResults.includes(activity.result as WhatsAppResult));
  return (
    isNonEmptyString(activity.id) &&
    typeof activity.type === 'string' &&
    activityTypes.includes(activity.type as ActivityType) &&
    isIsoDate(activity.occurredAt) &&
    isNonEmptyString(activity.author) &&
    hasValidResult &&
    typeof activity.note === 'string' &&
    isSubject(activity.subject) &&
    (activity.source === 'manual' || activity.source === 'automatic') &&
    (activity.event === undefined ||
      (typeof activity.event === 'string' &&
        automaticEvents.includes(activity.event as AutomaticActivityEvent))) &&
    Array.isArray(activity.noteRevisions) &&
    activity.noteRevisions.every(isNoteRevision) &&
    (activity.communication === undefined || isCommunication(activity.communication))
  );
}

export function loadActivities() {
  return loadCollection(ACTIVITIES_STORAGE_KEY, isActivity);
}

export function saveActivity(activity: Activity): boolean {
  try {
    if (!isActivity(activity)) return false;
    const records = readCollection(ACTIVITIES_STORAGE_KEY);
    if (records.some((record) => hasRecordId(record, activity.id))) return false;
    records.push(activity);
    localStorage.setItem(workspaceStorageKey(ACTIVITIES_STORAGE_KEY), JSON.stringify(records));
    emitLocalWrite();
    notifyActivityChange();
    return true;
  } catch {
    return false;
  }
}

export function recordAutomaticActivity(
  subject: ActivitySubject,
  event: AutomaticActivityEvent,
  note: string,
): boolean {
  return saveActivity({
    id: crypto.randomUUID(),
    type: 'relevantChange',
    occurredAt: new Date().toISOString(),
    author: 'Sistema local',
    result: 'Registrado automáticamente',
    note,
    subject,
    source: 'automatic',
    event,
    noteRevisions: [],
  });
}

export function recordCommercialOutcomeActivity(
  opportunityId: string,
  outcomeId: string,
  note: string,
): boolean {
  const id = `commercial-outcome:${outcomeId}`;
  try {
    const records = readCollection(ACTIVITIES_STORAGE_KEY);
    if (records.some((record) => hasRecordId(record, id))) return true;
    return saveActivity({
      id,
      type: 'relevantChange',
      occurredAt: new Date().toISOString(),
      author: 'Sistema local',
      result: 'Resultado comercial registrado',
      note,
      subject: { kind: 'opportunity', opportunityId },
      source: 'automatic',
      event: 'commercialOutcomeChanged',
      noteRevisions: [],
    });
  } catch {
    return false;
  }
}

export function recordNextActionActivity(
  opportunityId: string,
  actionId: string,
  event: 'completed' | 'rescheduled' | 'cancelled' | 'notRelevant',
  note: string,
): boolean {
  const id = `next-action:${actionId}:${event}`;
  try {
    const records = readCollection(ACTIVITIES_STORAGE_KEY);
    if (records.some((record) => hasRecordId(record, id))) return true;
    return saveActivity({
      id,
      type: 'relevantChange',
      occurredAt: new Date().toISOString(),
      author: 'Sistema local',
      result: 'Próxima acción actualizada',
      note,
      subject: { kind: 'opportunity', opportunityId },
      source: 'automatic',
      event: 'nextActionChanged',
      noteRevisions: [],
    });
  } catch {
    return false;
  }
}

export function recordCadenceActivity(
  subject: ActivitySubject,
  eventId: string,
  note: string,
): boolean {
  const id = `cadence:${eventId}`;
  try {
    const records = readCollection(ACTIVITIES_STORAGE_KEY);
    if (records.some((record) => hasRecordId(record, id))) return true;
    return saveActivity({
      id,
      type: 'relevantChange',
      occurredAt: new Date().toISOString(),
      author: 'Sistema local',
      result: 'Cadencia actualizada',
      note,
      subject,
      source: 'automatic',
      event: 'cadenceChanged',
      noteRevisions: [],
    });
  } catch {
    return false;
  }
}

export function appendActivityNoteRevision(
  activityId: string,
  author: string,
  revision: ActivityNoteRevision,
): boolean {
  try {
    if (!isNonEmptyString(activityId) || !isNonEmptyString(author) || !isNoteRevision(revision))
      return false;
    const records = readCollection(ACTIVITIES_STORAGE_KEY);
    const matching = records.filter((record) => hasRecordId(record, activityId));
    if (matching.length !== 1 || !isActivity(matching[0])) return false;
    const activity = matching[0];
    if (activity.source !== 'manual' || activity.author !== author) return false;
    const index = records.findIndex((record) => hasRecordId(record, activityId));
    records[index] = {
      ...activity,
      note: revision.note,
      noteRevisions: [...activity.noteRevisions, revision],
    };
    localStorage.setItem(workspaceStorageKey(ACTIVITIES_STORAGE_KEY), JSON.stringify(records));
    emitLocalWrite();
    notifyActivityChange();
    return true;
  } catch {
    return false;
  }
}

export function loadActivityAuthor(): string {
  try {
    return localStorage.getItem(workspaceStorageKey(ACTIVITY_AUTHOR_STORAGE_KEY))?.trim() ?? '';
  } catch {
    return '';
  }
}

export function saveActivityAuthor(author: string): boolean {
  try {
    const normalized = author.trim();
    if (!normalized) return false;
    localStorage.setItem(workspaceStorageKey(ACTIVITY_AUTHOR_STORAGE_KEY), normalized);
    return true;
  } catch {
    return false;
  }
}
