import type { Quote } from '../types/quote';
import { getQuoteCompletionError } from './quoteValidation';

export class QuoteFinalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuoteFinalizationError';
  }
}

export function finalizeQuote(quote: Readonly<Quote>): Quote {
  if (quote.status !== 'draft') {
    throw new QuoteFinalizationError('El presupuesto ya está finalizado.');
  }

  const validationError = getQuoteCompletionError(quote);

  if (validationError) {
    throw new QuoteFinalizationError(validationError);
  }

  return {
    id: quote.id,
    status: 'finalized',
    commercialStatus: quote.commercialStatus,
    commercialStatusAudit: { ...quote.commercialStatusAudit },
    ...(quote.sentAudit ? { sentAudit: { ...quote.sentAudit } } : {}),
    ...(quote.clientId ? { clientId: quote.clientId } : {}),
    ...(quote.opportunityId ? { opportunityId: quote.opportunityId } : {}),
    clientName: quote.clientName,
    projectName: quote.projectName,
    lines: quote.lines.map((line) => ({ ...line })),
  };
}
