export type CommercialOutcomeField = 'reasonCode' | 'note' | 'author';

export interface CommercialOutcomeDraft {
  needsReason: boolean;
  reasonCode: string;
  note: string;
  author: string;
}

/** Display order of the "Resultado comercial" fields, used to focus the first invalid one. */
export const commercialOutcomeFieldOrder: readonly CommercialOutcomeField[] = [
  'reasonCode',
  'note',
  'author',
];

/**
 * Field-level validation for "Resultado comercial" (SCRUM-107). Same rules as the previous
 * combined message ("Completá autor, motivo y una nota…"), reported on each field.
 */
export function getCommercialOutcomeFieldErrors(
  draft: CommercialOutcomeDraft,
): Partial<Record<CommercialOutcomeField, string>> {
  const errors: Partial<Record<CommercialOutcomeField, string>> = {};
  if (draft.needsReason && !draft.reasonCode) errors.reasonCode = 'Elegí un motivo.';
  if (draft.reasonCode === 'other' && !draft.note.trim())
    errors.note = 'Ingresá una nota: es obligatoria cuando el motivo es “Otro”.';
  if (!draft.author.trim()) errors.author = 'Ingresá el autor del resultado.';
  return errors;
}
