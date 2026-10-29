import type {
  Prospect,
  ProspectChannel,
  ProspectActivity,
  ProspectContactResult,
  ProspectInput,
  ProspectPriority,
  ProspectStatus,
} from '../types/prospect';
import { formatActivityDateTime } from './activityTimeline';
import { isPendingEmail, isPendingPhone } from './clientValidation';
import {
  getLocalDateKey,
  getLocalDateKeyFromFollowUp,
  localDateTimeToIso,
} from './prospectFollowUp';

export const prospectStatusLabels: Record<ProspectStatus, string> = {
  uncontacted: 'Sin contactar',
  contactToday: 'Contactar hoy',
  contacted: 'Contactado',
  noResponse: 'Sin respuesta',
  interested: 'Interesado',
  notInterested: 'No interesado',
  converted: 'Convertido',
};
export const prospectPriorityLabels: Record<ProspectPriority, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};
export const priorityWeight: Record<ProspectPriority, number> = { high: 0, medium: 1, low: 2 };
export const prospectContactResultLabels: Record<ProspectContactResult, string> = {
  contacted: 'Contactado',
  noResponse: 'No respondió',
  reschedule: 'Reagendar',
  discarded: 'Descartar',
};
export const prospectChannelLabels: Record<ProspectChannel, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  phone: 'Llamada',
  instagram: 'Instagram',
};

// Raw result codes that older versions stored as the note when the user left it empty.
const internalResultCodes = new Set([
  'effectiveContact',
  'noAnswer',
  'notInterested',
  'invalidNumber',
]);

export interface ProspectActivityDisplay {
  title: string;
  /** Replaces the generic activity type label when the entry has a more specific meaning. */
  kindLabel?: string;
  note?: string;
  followUp?: string;
}

/** Prefix used by profile edit entries; stored as a regular note so older clients can read it. */
export const PROFILE_CHANGE_PREFIX = 'Datos actualizados:';
/** History entries written when a prospect is archived or restored (SCRUM-111). */
export const ARCHIVE_PREFIX = 'Archivado:';
export const RESTORE_DESCRIPTION = 'Restaurado desde archivados.';

/** Notes the app writes by itself (profile edits, archive); they are traceability, not contacts. */
export function isProspectSystemNote(description: string): boolean {
  return (
    description.startsWith(PROFILE_CHANGE_PREFIX) ||
    description.startsWith(ARCHIVE_PREFIX) ||
    description === RESTORE_DESCRIPTION
  );
}

export const prospectArchiveReasons = [
  'No interesado',
  'Duplicado',
  'Datos incorrectos',
  'Ya es cliente',
  'Otro',
] as const;

export function isProspectArchived(prospect: Pick<Prospect, 'archivedAt'>): boolean {
  return Boolean(prospect.archivedAt);
}

/** Prospects the bulk cleanup archives: converted or not interested, and still active. */
export function getBulkArchiveCandidates(prospects: readonly Prospect[]): Prospect[] {
  return prospects.filter(
    (item) =>
      !isProspectArchived(item) && (item.status === 'converted' || item.status === 'notInterested'),
  );
}

/** Applies an archive or restore to the local copy, with its history entry (SCRUM-111). */
export function withProspectArchived(
  prospect: Prospect,
  input: { archived: boolean; reason?: string; author?: string; at?: string; version?: number },
): Prospect {
  const at = input.at ?? new Date().toISOString();
  const description = input.archived
    ? `${ARCHIVE_PREFIX} ${input.reason?.trim() || 'Sin motivo'}.`
    : RESTORE_DESCRIPTION;
  const { archivedAt: _previous, ...rest } = prospect;
  void _previous;
  return {
    ...rest,
    ...(input.archived ? { archivedAt: at } : {}),
    ...(input.version !== undefined ? { version: input.version } : {}),
    updatedAt: at,
    activities: [
      ...prospect.activities,
      {
        id: crypto.randomUUID(),
        prospectId: prospect.id,
        occurredAt: at,
        createdAt: at,
        type: 'note',
        description,
        ...(input.author?.trim() ? { author: input.author.trim() } : {}),
      },
    ],
  };
}

/**
 * Builds the history entry from the structured activity fields so channel, result, note and
 * next-step changes are always visible together (SCRUM-102, SCRUM-103).
 */
export function getProspectActivityDisplay(activity: ProspectActivity): ProspectActivityDisplay {
  const channel = activity.channel ? prospectChannelLabels[activity.channel] : undefined;
  const result = activity.result ? prospectContactResultLabels[activity.result] : undefined;
  const title =
    activity.type === 'contactResult' && (channel || result)
      ? `${[channel, result].filter(Boolean).join(': ')}.`
      : activity.description;
  const display: ProspectActivityDisplay = { title };
  if (activity.description.startsWith(PROFILE_CHANGE_PREFIX)) display.kindLabel = 'Cambio de datos';
  if (activity.description.startsWith(ARCHIVE_PREFIX)) display.kindLabel = 'Archivado';
  if (activity.description === RESTORE_DESCRIPTION) display.kindLabel = 'Restaurado';
  const note = activity.note?.trim();
  if (note && note !== title && !internalResultCodes.has(note)) display.note = note;
  if (activity.followUpAt) {
    display.followUp =
      activity.previousFollowUpAt && activity.previousFollowUpAt !== activity.followUpAt
        ? `Próximo paso reprogramado: ${formatActivityDateTime(activity.previousFollowUpAt)} → ${formatActivityDateTime(activity.followUpAt)}`
        : `Próximo paso: ${formatActivityDateTime(activity.followUpAt)}`;
  } else if (activity.previousFollowUpAt) {
    display.followUp = `Próximo paso cerrado (estaba agendado para ${formatActivityDateTime(activity.previousFollowUpAt)}).`;
  }
  return display;
}

const profileChangeFields: { key: keyof ProspectInput; label: string }[] = [
  { key: 'name', label: 'Nombre' },
  { key: 'company', label: 'Empresa' },
  { key: 'phone', label: 'Teléfono' },
  { key: 'email', label: 'Email' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'address', label: 'Dirección' },
  { key: 'source', label: 'Origen' },
  { key: 'potentialService', label: 'Servicio potencial' },
  { key: 'notes', label: 'Observaciones' },
  { key: 'priority', label: 'Prioridad' },
  { key: 'responsible', label: 'Responsable' },
  { key: 'preferredChannel', label: 'Canal preferido' },
];

function profileValue(key: keyof ProspectInput, value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '(vacío)';
  if (key === 'priority') return prospectPriorityLabels[text as ProspectPriority] ?? text;
  if (key === 'preferredChannel') return prospectChannelLabels[text as ProspectChannel] ?? text;
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

/** Human-readable list of profile changes, e.g. "Origen: Referido → Web". */
export function describeProspectProfileChanges(before: Prospect, after: Prospect): string[] {
  return profileChangeFields
    .filter(
      ({ key }) => (before[key] ?? '').toString().trim() !== (after[key] ?? '').toString().trim(),
    )
    .map(
      ({ key, label }) =>
        `${label}: ${profileValue(key, before[key])} → ${profileValue(key, after[key])}`,
    );
}

/** Appends a history entry describing what changed, who changed it and when (SCRUM-103). */
export function withProspectProfileChangeActivity(
  before: Prospect,
  after: Prospect,
  author?: string,
): Prospect {
  const changes = describeProspectProfileChanges(before, after);
  if (!changes.length) return after;
  const now = new Date().toISOString();
  return {
    ...after,
    activities: [
      ...after.activities,
      {
        id: crypto.randomUUID(),
        occurredAt: now,
        prospectId: after.id,
        createdAt: now,
        type: 'note',
        description: `${PROFILE_CHANGE_PREFIX} ${changes.join('; ')}.`,
        ...(author?.trim() ? { author: author.trim() } : {}),
      },
    ],
  };
}

export function getProspectStatusFromContactResult(result: string): ProspectStatus {
  if (result === 'Sin contactar') return 'uncontacted';
  if (result === 'Interesado') return 'interested';
  if (result === 'No interesado') return 'notInterested';
  if (result === 'Sin respuesta') return 'noResponse';
  return 'contacted';
}

export interface ProspectFilters {
  status: ProspectStatus | 'all';
  priority: ProspectPriority | 'all';
  channel: string;
  service: string;
}
export const defaultProspectFilters: ProspectFilters = {
  status: 'all',
  priority: 'all',
  channel: 'all',
  service: 'all',
};

const filterStatuses = Object.keys(prospectStatusLabels) as ProspectStatus[];
const filterPriorities = Object.keys(prospectPriorityLabels) as ProspectPriority[];
const filterChannels = Object.keys(prospectChannelLabels);

/**
 * Keeps only filter values the dropdowns can show (SCRUM-110). Anything else, such as an empty
 * value or a service that no prospect has anymore, falls back to 'all', so the list never
 * filters by a value the user cannot see.
 */
export function normalizeProspectFilters(
  value: unknown,
  options: { services?: readonly string[] } = {},
): ProspectFilters {
  const stored =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const pick = <T extends string>(raw: unknown, allowed: readonly T[]): T | 'all' =>
    typeof raw === 'string' && (allowed as readonly string[]).includes(raw) ? (raw as T) : 'all';
  const service =
    typeof stored.service === 'string' &&
    stored.service.trim() !== '' &&
    (!options.services || options.services.includes(stored.service))
      ? stored.service
      : 'all';
  return {
    status: pick(stored.status, filterStatuses),
    priority: pick(stored.priority, filterPriorities),
    channel: pick(stored.channel, filterChannels),
    service,
  };
}

export function countActiveProspectFilters(filters: ProspectFilters): number {
  return (Object.values(filters) as string[]).filter((value) => value !== 'all').length;
}

export function normalizeIdentity(value: string): string {
  return value.trim().toLocaleLowerCase('es').replace(/\s+/g, ' ');
}
export function normalizePhone(value: string): string {
  return value.replace(/\D/g, '');
}
export function isDuplicateProspect(
  candidate: Pick<Prospect, 'name' | 'company' | 'email' | 'phone'>,
  prospects: readonly Pick<Prospect, 'name' | 'company' | 'email' | 'phone'>[],
): boolean {
  const email = normalizeIdentity(candidate.email);
  const phone = normalizePhone(candidate.phone);
  const nameCompany = `${normalizeIdentity(candidate.company)}|${normalizeIdentity(candidate.name)}`;
  return prospects.some(
    (item) =>
      (email && !isPendingEmail(email) && email === normalizeIdentity(item.email)) ||
      (phone && !isPendingPhone(phone) && phone === normalizePhone(item.phone)) ||
      (normalizeIdentity(candidate.name) &&
        normalizeIdentity(candidate.company) &&
        nameCompany === `${normalizeIdentity(item.company)}|${normalizeIdentity(item.name)}`),
  );
}
export type ProspectListView = 'active' | 'archived';

export function filterProspects(
  prospects: readonly Prospect[],
  filters: ProspectFilters,
  view: ProspectListView = 'active',
): Prospect[] {
  return prospects.filter(
    (item) =>
      isProspectArchived(item) === (view === 'archived') &&
      (filters.status === 'all' || item.status === filters.status) &&
      (filters.priority === 'all' || item.priority === filters.priority) &&
      (filters.channel === 'all' || item.preferredChannel === filters.channel) &&
      (filters.service === 'all' || item.potentialService === filters.service),
  );
}
export function transitionProspect(
  prospect: Prospect,
  status: ProspectStatus,
  author = '',
): Prospect {
  if (status === prospect.status) return prospect;
  const now = new Date().toISOString();
  return {
    ...prospect,
    status,
    updatedAt: now,
    activities: [
      ...prospect.activities,
      {
        id: crypto.randomUUID(),
        occurredAt: now,
        type: 'statusChanged',
        description: `Estado cambiado de ${prospectStatusLabels[prospect.status]} a ${prospectStatusLabels[status]}.`,
        ...(author.trim() ? { author: author.trim() } : {}),
      },
    ],
  };
}
export function createProspectWhatsAppUrl(phone: string): string | null {
  const normalized = normalizePhone(phone);
  return normalized && !isPendingPhone(normalized) ? `https://wa.me/${normalized}` : null;
}

export function createProspectInstagramUrl(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return null;
  if (/^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._-]+\/?(?:\?.*)?$/i.test(trimmed))
    return trimmed;
  const handle = trimmed.replace(/^@/, '');
  return /^[A-Za-z0-9._-]+$/.test(handle) ? `https://www.instagram.com/${handle}/` : null;
}

export interface ProspectActionInput {
  result: ProspectContactResult;
  channel: ProspectChannel;
  note: string;
  followUpAt?: string;
  author?: string;
}

function normalizeFollowUpAt(
  value: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(trimmed)) {
    const date = new Date(trimmed);
    if (Number.isFinite(date.getTime())) return { ok: true, value: date.toISOString() };
  }
  return localDateTimeToIso(trimmed);
}

export function getProspectActionValidationError(input: ProspectActionInput): string | null {
  if (input.result === 'reschedule' || input.followUpAt?.trim()) {
    const result = normalizeFollowUpAt(input.followUpAt?.trim() ?? '');
    if (!result.ok) return result.error;
  }
  return null;
}

export function registerProspectAction(prospect: Prospect, input: ProspectActionInput): Prospect {
  const error = getProspectActionValidationError(input);
  if (error) throw new Error(error);
  const now = new Date().toISOString();
  const contactStatus: ProspectStatus =
    input.result === 'noResponse'
      ? 'noResponse'
      : input.result === 'discarded'
        ? 'notInterested'
        : 'contacted';
  let followUpAt = '';
  if (input.followUpAt?.trim()) {
    const normalizedFollowUp = normalizeFollowUpAt(input.followUpAt?.trim() ?? '');
    if (!normalizedFollowUp.ok) throw new Error(normalizedFollowUp.error);
    followUpAt = normalizedFollowUp.value;
  }
  // The status describes what happened in this contact; the next step is tracked separately.
  // Only an explicit reschedule (no contact happened) keeps the current status.
  const status = input.result === 'reschedule' ? prospect.status : contactStatus;
  return {
    ...prospect,
    status,
    nextAction: followUpAt ? 'Retomar contacto' : '',
    nextActionAt: followUpAt,
    updatedAt: now,
    activities: [
      ...prospect.activities,
      {
        id: crypto.randomUUID(),
        occurredAt: now,
        prospectId: prospect.id,
        createdAt: now,
        type: 'contactResult',
        description: `${prospectChannelLabels[input.channel]}: ${prospectContactResultLabels[input.result]}.`,
        result: input.result,
        channel: input.channel,
        // The pending step this result closes or replaces (rescheduled / completed follow-up).
        ...(prospect.nextActionAt && prospect.nextActionAt !== followUpAt
          ? { previousFollowUpAt: prospect.nextActionAt }
          : {}),
        ...(input.note.trim() ? { note: input.note.trim() } : {}),
        ...(input.author?.trim() ? { author: input.author.trim() } : {}),
        ...(followUpAt ? { followUpAt } : {}),
      },
    ],
  };
}
export function getDueGroup(
  prospect: Prospect,
  today = new Date(),
): 'overdue' | 'today' | 'upcoming' | null {
  if (
    !prospect.nextActionAt ||
    prospect.status === 'notInterested' ||
    prospect.status === 'converted'
  )
    return null;
  const localToday = getLocalDateKey(today);
  const actionDate = getLocalDateKeyFromFollowUp(prospect.nextActionAt);
  if (!actionDate) return null;
  return actionDate < localToday ? 'overdue' : actionDate === localToday ? 'today' : 'upcoming';
}
export function sortProspectsForContact(prospects: readonly Prospect[]): Prospect[] {
  return [...prospects].sort(
    (a, b) =>
      priorityWeight[a.priority] - priorityWeight[b.priority] ||
      (a.nextActionAt || '9999').localeCompare(b.nextActionAt || '9999') ||
      a.name.localeCompare(b.name, 'es'),
  );
}
