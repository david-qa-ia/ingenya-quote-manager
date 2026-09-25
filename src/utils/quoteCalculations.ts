import type { QuoteLine } from '../types/quote';

export function calculateLineSubtotal(quantity: number, unitPrice: number): number {
  return quantity * unitPrice;
}

export function calculateQuoteTotal(lines: QuoteLine[]): number {
  return lines.reduce(
    (total, line) => total + calculateLineSubtotal(line.quantity, line.unitPrice),
    0,
  );
}
