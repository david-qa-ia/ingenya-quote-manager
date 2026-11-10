import type { QuoteDiscount, QuoteLine } from '../types/quote';
import { formatCurrency } from './quoteFormatting';

export function calculateLineSubtotal(quantity: number, unitPrice: number): number {
  return quantity * unitPrice;
}

/** Sum of the services, before the discount. */
export function calculateQuoteSubtotal(lines: readonly QuoteLine[]): number {
  return lines.reduce(
    (total, line) => total + calculateLineSubtotal(line.quantity, line.unitPrice),
    0,
  );
}

/** Pesos taken off the subtotal: a percentage follows the services, an amount stays fixed. */
export function calculateDiscountAmount(
  subtotal: number,
  discount: QuoteDiscount | undefined,
): number {
  if (!discount || !(discount.value > 0)) return 0;
  const amount =
    discount.type === 'percent' ? Math.round(subtotal * discount.value) / 100 : discount.value;
  return Math.min(amount, subtotal);
}

/** Final total of the quote: subtotal minus the discount (never below zero). */
export function calculateQuoteTotal(lines: readonly QuoteLine[], discount?: QuoteDiscount): number {
  const subtotal = calculateQuoteSubtotal(lines);
  return subtotal - calculateDiscountAmount(subtotal, discount);
}

/** Whether a stored value is a discount the app can apply. */
export function isQuoteDiscount(value: unknown): value is QuoteDiscount {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    (record.type === 'percent' || record.type === 'amount') &&
    typeof record.value === 'number' &&
    Number.isFinite(record.value) &&
    record.value >= 0 &&
    (record.type === 'amount' || record.value <= 100)
  );
}

/**
 * The message that blocks finalizing: a percentage from 0% to 100%, an amount from $0 up to the
 * subtotal. An amount larger than a subtotal that dropped asks to adjust it.
 */
export function getQuoteDiscountError(
  discount: QuoteDiscount | undefined,
  subtotal: number,
): string | null {
  if (!discount) return null;
  if (!Number.isFinite(discount.value) || discount.value < 0) return 'Ingresá un descuento válido.';
  if (discount.type === 'percent' && discount.value > 100)
    return 'El descuento tiene que ser de 0% a 100%.';
  if (discount.type === 'amount' && discount.value > subtotal)
    return `El descuento supera el subtotal (${formatCurrency(subtotal)}). Ajustalo antes de finalizar.`;
  return null;
}

/** "Descuento 10%" for a percentage; "Descuento" for a fixed amount. */
export const discountLabel = (discount: QuoteDiscount) =>
  discount.type === 'percent'
    ? `Descuento ${discount.value.toLocaleString('es-AR', { maximumFractionDigits: 2 })}%`
    : 'Descuento';

export interface QuoteTotals {
  readonly subtotal: number;
  /** Pesos taken off; 0 when there is no discount. */
  readonly discountAmount: number;
  readonly discountLabel: string;
  readonly total: number;
}

export function getQuoteTotals(
  lines: readonly QuoteLine[],
  discount: QuoteDiscount | undefined,
): QuoteTotals {
  const subtotal = calculateQuoteSubtotal(lines);
  const discountAmount = calculateDiscountAmount(subtotal, discount);
  return {
    subtotal,
    discountAmount,
    discountLabel: discount ? discountLabel(discount) : '',
    total: subtotal - discountAmount,
  };
}
