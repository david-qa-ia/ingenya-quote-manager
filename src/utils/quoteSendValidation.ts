export type QuoteSendField = 'sentAt' | 'responsible' | 'note' | 'nextStepAt';

export interface QuoteSendDraft {
  channel: string;
  /** Argentina local date-time, as entered in a datetime-local input. */
  sentAt: string;
  responsible: string;
  note: string;
  nextStep: string;
  nextStepAt: string;
}

/** Display order of the "Registrar envío" fields, used to focus the first invalid one. */
export const quoteSendFieldOrder: readonly QuoteSendField[] = [
  'sentAt',
  'responsible',
  'note',
  'nextStepAt',
];

export function argentinaTimestamp(value: string): number {
  return Date.parse(`${value}:00-03:00`);
}

/**
 * Field-level validation for "Registrar envío" (SCRUM-107). Same rules and messages the drawer
 * already applied, reported on each field instead of one message at a time.
 */
export function getQuoteSendFieldErrors(
  draft: QuoteSendDraft,
  now = Date.now(),
): Partial<Record<QuoteSendField, string>> {
  const errors: Partial<Record<QuoteSendField, string>> = {};
  if (!draft.responsible.trim()) errors.responsible = 'Indicá quién registró el envío.';
  const sent = argentinaTimestamp(draft.sentAt);
  if (!draft.sentAt || Number.isNaN(sent) || sent > now)
    errors.sentAt = 'La fecha y hora de envío debe ser válida y no futura.';
  const next = draft.nextStepAt ? argentinaTimestamp(draft.nextStepAt) : NaN;
  if (draft.nextStep !== 'none' && (!draft.nextStepAt || Number.isNaN(next) || next <= now))
    errors.nextStepAt = 'El próximo paso debe tener una fecha futura.';
  if (draft.channel === 'other' && !draft.note.trim())
    errors.note = 'Indicá una nota para registrar otro canal.';
  return errors;
}
