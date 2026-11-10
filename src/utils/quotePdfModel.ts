import { workUnitSymbols } from '../data/workUnits';
import { loadCompanyBrand } from './companyProfileStorage';
import type { DeploymentBrandConfig } from '../types/branding';
import type { Client } from '../types/client';
import type { Opportunity } from '../types/opportunity';
import type { Quote, SavedQuote } from '../types/quote';
import { calculateLineSubtotal, getQuoteTotals } from './quoteCalculations';
import { isValidQuoteLine } from './quoteValidation';

export interface QuotePdfLine {
  /** The service as the client reads it, and the scope written for it (may be empty). */
  readonly name: string;
  readonly details: string;
  /** Unit symbol printed next to the quantity (m², ml, u). */
  readonly unit: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly subtotal: number;
}

/** Who the quote is for. The name is the quote snapshot; contact data comes from the client. */
export interface QuotePdfRecipient {
  readonly name: string;
  readonly company: string;
  readonly phone: string;
  readonly email: string;
}

/** A label and its text in the conditions block of the document. */
export interface QuotePdfCondition {
  readonly label: string;
  readonly text: string;
}

export interface QuotePdfModel {
  readonly id: string;
  readonly isDraft: boolean;
  readonly title: string;
  readonly recipient: QuotePdfRecipient;
  /** Address of the job, when the quote belongs to an opportunity that has one. */
  readonly siteAddress: string;
  readonly lines: readonly QuotePdfLine[];
  /** Sum of the services; with a discount the PDF shows it, the discount and the total. */
  readonly subtotal: number;
  readonly discountAmount: number;
  readonly discountLabel: string;
  readonly total: number;
  readonly conditions: readonly QuotePdfCondition[];
  readonly acceptanceText: string;
  readonly fileName: string;
  readonly brand: DeploymentBrandConfig;
  /** SCRUM-119: issue date and the date the quote stays valid until (dd/mm/aaaa). */
  readonly issuedOn: string;
  readonly validUntil: string;
}

/** Current data of the client and opportunity linked to the quote, read when the PDF is made. */
export interface QuotePdfContext {
  readonly client?: Pick<Client, 'company' | 'phone' | 'email'>;
  readonly opportunity?: Pick<Opportunity, 'address'>;
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

/** How the client confirms: by WhatsApp when the company has one, otherwise by answering. */
export function quotePdfAcceptanceText(brand: DeploymentBrandConfig): string {
  const whatsapp = brand.whatsapp.display.trim();
  return whatsapp
    ? `Para aceptarlo, firmá esta página y enviala, o confirmalo por WhatsApp al ${whatsapp}. Con tu confirmación coordinamos el inicio.`
    : 'Para aceptarlo, firmá esta página y enviala, o confirmalo respondiendo este envío. Con tu confirmación coordinamos el inicio.';
}

/**
 * The conditions block: what the workspace wrote in Configuración (each one only when filled)
 * and always the validity, explained in words.
 */
export function quotePdfConditions(
  brand: DeploymentBrandConfig,
  validUntil: string,
): QuotePdfCondition[] {
  const conditions = brand.quoteConditions;
  return [
    { label: 'Incluye', text: conditions?.included.trim() ?? '' },
    { label: 'No incluye', text: conditions?.excluded.trim() ?? '' },
    { label: 'Plazo de ejecución', text: conditions?.executionTime.trim() ?? '' },
    { label: 'Forma de pago', text: conditions?.paymentTerms.trim() ?? '' },
    {
      label: 'Validez',
      text: `Los precios de este presupuesto se mantienen hasta el ${validUntil}.`,
    },
  ].filter((condition) => condition.text);
}

export function prepareQuotePdfModel(
  quote: Readonly<Quote>,
  brand: DeploymentBrandConfig = loadCompanyBrand(),
  now: Date = new Date(),
  context: QuotePdfContext = {},
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
  const clientName = quote.clientName.trim();
  // A finalized quote keeps the date it was saved; a draft is dated when the PDF is made.
  const savedAt = (quote as Partial<SavedQuote>).savedAt;
  const issued =
    quote.status === 'finalized' && savedAt && Number.isFinite(Date.parse(savedAt))
      ? new Date(savedAt)
      : now;
  const validityDays = brand.quoteValidityDays ?? 15;
  const validUntil = pdfDateFormatter.format(
    new Date(issued.getTime() + validityDays * 86_400_000),
  );
  const company = context.client?.company?.trim() ?? '';

  return {
    id: quote.id,
    isDraft: quote.status === 'draft',
    title: projectName || 'Propuesta de servicios',
    recipient: {
      name: clientName || 'Sin cliente',
      company: company && company !== clientName ? company : '',
      phone: context.client?.phone.trim() ?? '',
      email: context.client?.email.trim() ?? '',
    },
    siteAddress: context.opportunity?.address.trim() ?? '',
    lines: quote.lines.map((line) => ({
      name: line.name.trim(),
      details: line.description?.trim() ?? '',
      unit: workUnitSymbols[line.unit],
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      subtotal: calculateLineSubtotal(line.quantity, line.unitPrice),
    })),
    ...getQuoteTotals(quote.lines, quote.discount),
    conditions: quotePdfConditions(brand, validUntil),
    acceptanceText: quotePdfAcceptanceText(brand),
    fileName: createSafeQuotePdfFileName(quote.id),
    brand,
    issuedOn: pdfDateFormatter.format(issued),
    validUntil,
  };
}
