import { workUnitLabels, workUnitSymbols } from '../data/workUnits';
import type { Quote } from '../types/quote';
import { calculateLineSubtotal, calculateQuoteTotal } from './quoteCalculations';
import { isValidQuoteLine } from './quoteValidation';

export interface QuotePdfLine {
  readonly description: string;
  readonly unit: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly subtotal: number;
}

export interface QuotePdfModel {
  readonly id: string;
  readonly clientName: string;
  readonly projectName: string;
  readonly status: 'Borrador' | 'Finalizado';
  readonly lines: readonly QuotePdfLine[];
  readonly total: number;
  readonly fileName: string;
}

export class QuotePdfValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotePdfValidationError';
  }
}

export function createSafeQuotePdfFileName(quoteId: string): string {
  const safeId = quoteId.replace(/[^a-zA-Z0-9._-]/g, '-');
  return `presupuesto-${safeId}.pdf`;
}

export function prepareQuotePdfModel(quote: Readonly<Quote>): QuotePdfModel {
  if (quote.lines.length === 0) {
    throw new QuotePdfValidationError(
      'Agregá al menos un servicio válido antes de descargar el PDF.',
    );
  }

  if (!quote.lines.every(isValidQuoteLine)) {
    throw new QuotePdfValidationError(
      'No se puede generar el PDF porque uno o más servicios tienen datos inválidos.',
    );
  }

  return {
    id: quote.id,
    clientName: quote.clientName.trim() || 'Sin cliente',
    projectName: quote.projectName.trim() || 'Sin obra',
    status: quote.status === 'draft' ? 'Borrador' : 'Finalizado',
    lines: quote.lines.map((line) => ({
      description: line.name,
      unit: `${workUnitLabels[line.unit]} (${workUnitSymbols[line.unit]})`,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      subtotal: calculateLineSubtotal(line.quantity, line.unitPrice),
    })),
    total: calculateQuoteTotal(quote.lines),
    fileName: createSafeQuotePdfFileName(quote.id),
  };
}
