import { parseLocaleNumber } from './localeNumber';

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
  const quantity = parseLocaleNumber(draft.quantity);
  if (quantity === null || quantity <= 0)
    errors.quantity = 'Ingresá una cantidad mayor a cero, por ejemplo 12,5.';
  const unitPrice = parseLocaleNumber(draft.unitPrice);
  if (unitPrice === null || unitPrice < 0)
    errors.unitPrice = 'Ingresá un precio válido, por ejemplo 120.000 o 1.250,50.';
  return errors;
}
