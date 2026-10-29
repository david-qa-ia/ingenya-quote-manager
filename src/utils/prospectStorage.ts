import type {
  Prospect,
  ProspectConversion,
  ProspectInput,
  ProspectStatus,
} from '../types/prospect';
import { isPendingEmail, isPendingPhone } from './clientValidation';
import { hasRecordId, loadCollection } from './localCollectionStorage';
import { getLocalDateKeyFromFollowUp } from './prospectFollowUp';
import { workspaceStorageKey } from './workspaceStorage';

export const PROSPECTS_STORAGE_KEY = 'ingenya.prospects.v1';
export const PROSPECT_FILTERS_STORAGE_KEY = 'ingenya.prospectFilters.v1';

const statuses: ProspectStatus[] = [
  'uncontacted',
  'contactToday',
  'contacted',
  'noResponse',
  'interested',
  'notInterested',
  'converted',
];

const text = (value: unknown) => typeof value === 'string';
const iso = (value: unknown) => text(value) && Number.isFinite(Date.parse(value));
function isConversion(value: unknown): value is ProspectConversion {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const conversion = value as Record<string, unknown>;
  const draft = conversion.draft as Record<string, unknown> | undefined;
  return (
    (conversion.state === 'pending' || conversion.state === 'completed') &&
    iso(conversion.startedAt) &&
    (conversion.completedAt === undefined || iso(conversion.completedAt)) &&
    !!draft &&
    [
      'clientId',
      'clientName',
      'clientPhone',
      'clientEmail',
      'opportunityId',
      'opportunityName',
      'serviceOfInterest',
      'detectedNeed',
      'nextStep',
      'nextStepAt',
      'responsible',
    ].every((key) => text(draft[key]) && (draft[key] as string).trim().length > 0) &&
    // Company is optional for prospects, so a converted prospect may not have one.
    text(draft.clientCompany) &&
    ['', 'phone', 'whatsapp', 'email', 'instagram'].includes(
      draft.clientPreferredChannel as string,
    ) &&
    ['call', 'whatsapp', 'email', 'instagram', 'meeting', 'waitForResponse', 'other'].includes(
      draft.nextStepChannel as string,
    ) &&
    ['high', 'medium', 'low'].includes(draft.interestLevel as string) &&
    iso(draft.nextStepAt) &&
    (draft.estimatedValue === undefined ||
      (typeof draft.estimatedValue === 'number' &&
        Number.isFinite(draft.estimatedValue) &&
        draft.estimatedValue >= 0))
  );
}

export function createNewProspect(): Prospect {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: '',
    company: '',
    phone: '',
    email: '',
    instagram: '',
    address: '',
    source: '',
    potentialService: '',
    notes: '',
    status: 'uncontacted',
    priority: 'medium',
    priorityReason: 'Prioridad manual',
    nextAction: '',
    nextActionAt: '',
    responsible: '',
    preferredChannel: '',
    activities: [],
    createdAt: now,
    updatedAt: now,
  };
}

export type ProspectFieldErrors = Partial<Record<keyof ProspectInput, string>>;

/** Validation order; the first invalid field is the one getProspectValidationError reports. */
export const prospectFieldOrder = [
  'name',
  'phone',
  'email',
  'priority',
  'status',
  'preferredChannel',
  'nextActionAt',
] as const satisfies readonly (keyof ProspectInput)[];

/** Same rules and messages as getProspectValidationError, reported per field (SCRUM-107). */
export function getProspectFieldErrors(input: ProspectInput): ProspectFieldErrors {
  const errors: ProspectFieldErrors = {};
  if (!input.name.trim()) errors.name = 'Ingresá el nombre del prospecto.';
  if (
    input.phone.trim() &&
    (!/^\+?[\d\s().-]+$/.test(input.phone.trim()) ||
      !/^\d{7,15}$/.test(input.phone.replace(/\D/g, '')))
  )
    errors.phone = 'El teléfono debe tener entre 7 y 15 dígitos.';
  if (
    input.email.trim() &&
    !isPendingEmail(input.email) &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())
  )
    errors.email = 'Ingresá un email válido o none si está pendiente.';
  if (!['high', 'medium', 'low'].includes(input.priority)) errors.priority = 'Revisá la prioridad.';
  if (!statuses.includes(input.status)) errors.status = 'Revisá el estado.';
  if (!['', 'phone', 'whatsapp', 'email', 'instagram'].includes(input.preferredChannel))
    errors.preferredChannel = 'Revisá el canal.';
  if (input.nextActionAt && !getLocalDateKeyFromFollowUp(input.nextActionAt))
    errors.nextActionAt = 'La próxima acción debe tener una fecha válida.';
  return errors;
}

export function getProspectValidationError(input: ProspectInput): string | null {
  const errors = getProspectFieldErrors(input);
  const first = prospectFieldOrder.find((field) => errors[field]);
  return first ? (errors[first] ?? null) : null;
}

export function normalizeProspectInput(input: ProspectInput): ProspectInput {
  return {
    ...input,
    name: input.name.trim(),
    company: input.company.trim(),
    phone: isPendingPhone(input.phone) ? '1111111111' : input.phone.trim(),
    email: isPendingEmail(input.email) ? 'none' : input.email.trim(),
    instagram: input.instagram?.trim() ?? '',
    address: input.address?.trim() ?? '',
    source: input.source.trim(),
    potentialService: input.potentialService.trim(),
    notes: input.notes.trim(),
    priorityReason: input.priorityReason.trim(),
    nextAction: input.nextAction.trim(),
    responsible: input.responsible.trim(),
  };
}

export function isProspect(value: unknown): value is Prospect {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (
    !['id', 'createdAt', 'updatedAt'].every((key) => text(item[key])) ||
    !iso(item.createdAt) ||
    !iso(item.updatedAt) ||
    !Array.isArray(item.activities)
  )
    return false;
  const input = item as unknown as ProspectInput;
  return (
    !!item.id &&
    getProspectValidationError(input) === null &&
    (item.conversion === undefined || isConversion(item.conversion)) &&
    (item.status !== 'converted' ||
      (isConversion(item.conversion) && item.conversion.state === 'completed')) &&
    item.activities.every((activity) => {
      if (!activity || typeof activity !== 'object') return false;
      const record = activity as Record<string, unknown>;
      return (
        text(record.id) &&
        iso(record.occurredAt) &&
        (record.prospectId === undefined || text(record.prospectId)) &&
        (record.createdAt === undefined || iso(record.createdAt)) &&
        text(record.type) &&
        [
          'statusChanged',
          'contactPrepared',
          'contactResult',
          'note',
          'conversionCompleted',
        ].includes(record.type) &&
        text(record.description) &&
        (record.author === undefined || text(record.author)) &&
        (record.result === undefined ||
          ['contacted', 'noResponse', 'reschedule', 'discarded'].includes(
            record.result as string,
          )) &&
        (record.channel === undefined ||
          ['phone', 'whatsapp', 'email', 'instagram'].includes(record.channel as string)) &&
        (record.note === undefined || text(record.note)) &&
        (record.followUpAt === undefined || text(record.followUpAt)) &&
        (record.previousFollowUpAt === undefined || text(record.previousFollowUpAt))
      );
    })
  );
}

export const loadProspects = () => loadCollection(PROSPECTS_STORAGE_KEY, isProspect);

export type SaveResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'validation' | 'storage_unavailable' | 'storage_write_failed' | 'unknown';
      error?: string;
    };

/** User-facing text for a failed local save; never exposes the internal reason code. */
export function getProspectSaveErrorMessage(result: Extract<SaveResult, { ok: false }>): string {
  if (result.reason === 'validation')
    return 'No se pudo guardar: hay datos del prospecto con un formato que no se puede guardar. Revisá los campos y volvé a intentar.';
  if (result.reason === 'storage_unavailable')
    return 'No se pudo guardar en este navegador porque el almacenamiento no está disponible. Lo que cargaste sigue en el formulario.';
  return 'No se pudo guardar en este navegador. Lo que cargaste sigue en el formulario; volvé a intentar en unos segundos.';
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function saveProspectWithResult(prospect: Prospect): SaveResult {
  const normalized = { ...prospect, ...normalizeProspectInput(prospect) };
  if (!isProspect(normalized))
    return {
      ok: false,
      reason: 'validation',
      error: 'El prospecto actualizado o uno de sus eventos no cumple el formato permitido.',
    };

  let stored: string | null;
  try {
    stored = localStorage.getItem(workspaceStorageKey(PROSPECTS_STORAGE_KEY));
  } catch (error) {
    return { ok: false, reason: 'storage_unavailable', error: describeError(error) };
  }

  let records: unknown[];
  try {
    const parsed: unknown = stored === null ? [] : JSON.parse(stored);
    if (!Array.isArray(parsed))
      return {
        ok: false,
        reason: 'storage_write_failed',
        error: 'La colección guardada no es un arreglo y se preservó sin sobrescribirla.',
      };
    records = parsed;
  } catch (error) {
    return { ok: false, reason: 'storage_write_failed', error: describeError(error) };
  }

  const matches = records.filter((value) => hasRecordId(value, normalized.id));
  if (matches.length > 1 || (matches.length === 1 && !isProspect(matches[0])))
    return {
      ok: false,
      reason: 'storage_write_failed',
      error: 'Hay un registro ambiguo o inválido con el mismo identificador.',
    };

  const index = records.findIndex((value) => hasRecordId(value, normalized.id));
  if (index < 0) records.push(normalized);
  else records[index] = normalized;
  try {
    localStorage.setItem(workspaceStorageKey(PROSPECTS_STORAGE_KEY), JSON.stringify(records));
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'storage_write_failed', error: describeError(error) };
  }
}

export function saveProspect(prospect: Prospect): boolean {
  return saveProspectWithResult(prospect).ok;
}

export function isProspectContactAvailable(
  prospect: Prospect,
  channel: 'phone' | 'whatsapp' | 'email' | 'instagram',
): boolean {
  if (channel === 'instagram') return Boolean(prospect.instagram?.trim());
  return channel === 'email'
    ? Boolean(prospect.email) && !isPendingEmail(prospect.email)
    : Boolean(prospect.phone) && !isPendingPhone(prospect.phone);
}
