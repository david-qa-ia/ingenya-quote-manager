import { workUnitLabels, workUnitSymbols } from '../data/workUnits';
import type { QuoteDraft, WorkUnit } from '../types/quote';
import { calculateLineSubtotal, calculateQuoteTotal } from './quoteCalculations';

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
  readonly status: 'Borrador';
  readonly lines: readonly QuotePdfLine[];
  readonly total: number;
  readonly fileName: string;
}

const recognizedUnits = new Set<WorkUnit>(Object.keys(workUnitLabels) as WorkUnit[]);

export class QuotePdfValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotePdfValidationError';
  }
}

function isValidLine(line: QuoteDraft['lines'][number]): boolean {
  return (
    line.name.trim().length > 0 &&
    recognizedUnits.has(line.unit) &&
    Number.isFinite(line.quantity) &&
    line.quantity > 0 &&
    Number.isFinite(line.unitPrice) &&
    line.unitPrice >= 0
  );
}

export function createSafeQuotePdfFileName(quoteId: string): string {
  const safeId = quoteId.replace(/[^a-zA-Z0-9._-]/g, '-');
  return `presupuesto-${safeId}.pdf`;
}

export function prepareQuotePdfModel(draft: Readonly<QuoteDraft>): QuotePdfModel {
  if (draft.lines.length === 0) {
    throw new QuotePdfValidationError(
      'Agregá al menos un servicio válido antes de descargar el PDF.',
    );
  }

  if (!draft.lines.every(isValidLine)) {
    throw new QuotePdfValidationError(
      'No se puede generar el PDF porque uno o más servicios tienen datos inválidos.',
    );
  }

  return {
    id: draft.id,
    clientName: draft.clientName.trim() || 'Sin cliente',
    projectName: draft.projectName.trim() || 'Sin obra',
    status: 'Borrador',
    lines: draft.lines.map((line) => ({
      description: line.name,
      unit: `${workUnitLabels[line.unit]} (${workUnitSymbols[line.unit]})`,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      subtotal: calculateLineSubtotal(line.quantity, line.unitPrice),
    })),
    total: calculateQuoteTotal(draft.lines),
    fileName: createSafeQuotePdfFileName(draft.id),
  };
}
