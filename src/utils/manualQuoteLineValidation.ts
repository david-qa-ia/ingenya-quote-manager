export type ManualQuoteLineField = 'name' | 'quantity' | 'unitPrice';

export const manualQuoteLineFieldOrder: readonly ManualQuoteLineField[] = [
  'name',
  'quantity',
  'unitPrice',
];

/**
 * Field-level validation for "Agregar servicio manual" (SCRUM-107). Same rules as before
 * (name required, quantity above zero, non-negative price), with one message per field.
 */
export function getManualQuoteLineFieldErrors(draft: {
  name: string;
  quantity: string;
  unitPrice: string;
}): Partial<Record<ManualQuoteLineField, string>> {
  const errors: Partial<Record<ManualQuoteLineField, string>> = {};
  if (!draft.name.trim()) errors.name = 'Ingresá el nombre del servicio.';
  const quantity = Number(draft.quantity);
  if (draft.quantity.trim() === '' || !Number.isFinite(quantity) || quantity <= 0)
    errors.quantity = 'Ingresá una cantidad mayor a cero.';
  const unitPrice = Number(draft.unitPrice);
  if (draft.unitPrice.trim() === '' || !Number.isFinite(unitPrice) || unitPrice < 0)
    errors.unitPrice = 'Ingresá un precio unitario igual o mayor a cero.';
  return errors;
}
