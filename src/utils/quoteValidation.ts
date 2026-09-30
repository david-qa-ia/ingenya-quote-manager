import type { Quote, QuoteLine, WorkUnit } from '../types/quote';

const validWorkUnits = new Set<WorkUnit>(['squareMeter', 'linearMeter', 'unit']);

export function isValidQuoteLine(line: Readonly<QuoteLine>): boolean {
  return (
    line.name.trim().length > 0 &&
    validWorkUnits.has(line.unit) &&
    Number.isFinite(line.quantity) &&
    line.quantity > 0 &&
    Number.isFinite(line.unitPrice) &&
    line.unitPrice >= 0
  );
}

export function getQuoteCompletionError(quote: Readonly<Quote>): string | null {
  if (quote.lines.length === 0) {
    return 'Agregá al menos un servicio antes de finalizar el presupuesto.';
  }

  if (!quote.lines.every(isValidQuoteLine)) {
    return 'Revisá los servicios: la descripción, la unidad, la cantidad o el precio no son válidos.';
  }

  return null;
}
