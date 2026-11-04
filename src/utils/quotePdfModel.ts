import { workUnitLabels, workUnitSymbols } from '../data/workUnits';
import { loadCompanyBrand } from './companyProfileStorage';
import type { DeploymentBrandConfig } from '../types/branding';
import type { Quote, SavedQuote } from '../types/quote';
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
  readonly proposalTitle: string;
  readonly isDraft: boolean;
  readonly brand: DeploymentBrandConfig;
  /** SCRUM-119: issue date and the date the quote stays valid until (dd/mm/aaaa). */
  readonly issuedOn: string;
  readonly validUntil: string;
}

const pdfDateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Argentina/Buenos_Aires',
});

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

// SCRUM-119: only the company name is required; missing contact data is left out of the PDF.
function validateBrandConfig(brand: DeploymentBrandConfig): void {
  if (!brand.companyName.trim()) {
    throw new QuotePdfValidationError(
      'No se puede generar el PDF porque la configuración comercial está incompleta.',
    );
  }
}

export function prepareQuotePdfModel(
  quote: Readonly<Quote>,
  brand: DeploymentBrandConfig = loadCompanyBrand(),
  now: Date = new Date(),
): QuotePdfModel {
  validateBrandConfig(brand);

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

  const projectName = quote.projectName.trim();
  // A finalized quote keeps the date it was saved; a draft is dated when the PDF is made.
  const savedAt = (quote as Partial<SavedQuote>).savedAt;
  const issued =
    quote.status === 'finalized' && savedAt && Number.isFinite(Date.parse(savedAt))
      ? new Date(savedAt)
      : now;
  const validityDays = brand.quoteValidityDays ?? 15;
  const validUntil = new Date(issued.getTime() + validityDays * 86_400_000);

  return {
    id: quote.id,
    clientName: quote.clientName.trim() || 'Sin cliente',
    projectName: projectName || 'Sin proyecto',
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
    proposalTitle: projectName || 'Propuesta de servicios',
    isDraft: quote.status === 'draft',
    brand,
    issuedOn: pdfDateFormatter.format(issued),
    validUntil: pdfDateFormatter.format(validUntil),
  };
}
