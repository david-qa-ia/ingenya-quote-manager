export type ActivityFormField = 'occurredAt' | 'author' | 'result' | 'note';

export interface ActivityFormDraft {
  noteOnly: boolean;
  type: string;
  occurredAt: string;
  author: string;
  result: string;
  note: string;
}

/** Display order of the activity / note form fields. */
export const activityFormFieldOrder: readonly ActivityFormField[] = [
  'occurredAt',
  'author',
  'result',
  'note',
];

/**
 * Field-level validation for "Registrar actividad" and "Agregar nota" (SCRUM-107). Same rules
 * as the previous combined message ("Completá autor, fecha, resultado y nota."), per field.
 */
export function getActivityFormFieldErrors(
  draft: ActivityFormDraft,
): Partial<Record<ActivityFormField, string>> {
  const errors: Partial<Record<ActivityFormField, string>> = {};
  if (!draft.noteOnly && !draft.occurredAt) errors.occurredAt = 'Elegí la fecha y hora.';
  if (!draft.author.trim()) errors.author = 'Ingresá el autor.';
  if (!draft.noteOnly && !draft.result.trim())
    errors.result = draft.type === 'call' ? 'Elegí el resultado.' : 'Ingresá el resultado.';
  if (!draft.note.trim()) errors.note = draft.noteOnly ? 'Ingresá la nota.' : 'Ingresá una nota.';
  return errors;
}
