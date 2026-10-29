import type { ResultNextStep } from '../components/RegisterResultDrawer';

export type RegisterResultField = 'result' | 'nextStep' | 'dueAt' | 'actor';

export interface RegisterResultDraft {
  result: string;
  nextStep: ResultNextStep;
  dueAt: string;
  actor: string;
  hasPendingAction: boolean;
}

export type RegisterResultFieldErrors = Partial<Record<RegisterResultField, string>>;

/** Display order of the fields in the result drawer, used to focus the first invalid one. */
export const registerResultFieldOrder: readonly RegisterResultField[] = [
  'result',
  'nextStep',
  'dueAt',
  'actor',
];

/**
 * Field-level validation for "Registrar resultado".
 * Keeps the existing rules (result, responsible, date for a scheduled step, and a next step
 * when the follow-up has no pending action) but reports each missing value on its own field.
 */
export function getRegisterResultFieldErrors(
  draft: RegisterResultDraft,
): RegisterResultFieldErrors {
  const errors: RegisterResultFieldErrors = {};
  if (!draft.result) errors.result = 'Elegí el resultado del contacto.';
  if (draft.nextStep === 'none' && !draft.hasPendingAction)
    errors.nextStep = 'Elegí un próximo paso: este seguimiento no tiene otra acción pendiente.';
  if (draft.nextStep !== 'none' && !draft.dueAt)
    errors.dueAt = 'Elegí la fecha y hora del próximo paso.';
  if (!draft.actor.trim()) errors.actor = 'Ingresá el responsable que registra el resultado.';
  return errors;
}

export function getFirstInvalidRegisterResultField(
  errors: RegisterResultFieldErrors,
): RegisterResultField | undefined {
  return registerResultFieldOrder.find((field) => errors[field]);
}
