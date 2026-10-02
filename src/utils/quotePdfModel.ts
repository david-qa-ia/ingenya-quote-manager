import { workUnitLabels, workUnitSymbols } from '../data/workUnits';
import { deploymentBrand } from '../config/deploymentBrand';
import type { DeploymentBrandConfig } from '../types/branding';
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
  readonly proposalTitle: string;
  readonly isDraft: boolean;
  readonly brand: DeploymentBrandConfig;
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

function validateBrandConfig(brand: DeploymentBrandConfig): void {
  if (
    !brand.companyName.trim() ||
    !brand.email.trim() ||
    !brand.whatsapp.display.trim() ||
    !brand.whatsapp.value.trim() ||
    !brand.footerBusinessText.trim()
  ) {
    throw new QuotePdfValidationError(
      'No se puede generar el PDF porque la configuración comercial está incompleta.',
    );
  }
}

export function prepareQuotePdfModel(
  quote: Readonly<Quote>,
  brand: DeploymentBrandConfig = deploymentBrand,
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

  return {
    id: quote.id,
    clientName: quote.clientName.trim() || 'Sin cliente',
    projectName: projectName || 'Sin obra',
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
  };
}
