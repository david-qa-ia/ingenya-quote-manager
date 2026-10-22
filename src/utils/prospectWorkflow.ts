import type {
  Prospect,
  ProspectChannel,
  ProspectContactResult,
  ProspectPriority,
  ProspectStatus,
} from '../types/prospect';
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
};

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
export function filterProspects(
  prospects: readonly Prospect[],
  filters: ProspectFilters,
): Prospect[] {
  return prospects.filter(
    (item) =>
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
  const status: ProspectStatus =
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
