import type { CommercialStatus, QuoteStatus, SavedQuote } from '../types/quote';

export type SavedQuoteFilter = 'all' | QuoteStatus;
export type SavedQuoteCommercialFilter = 'all' | CommercialStatus;

export function filterSavedQuotes(
  savedQuotes: readonly SavedQuote[],
  filter: SavedQuoteFilter,
): SavedQuote[] {
  return savedQuotes.filter((quote) => filter === 'all' || quote.status === filter);
}

export function filterSavedQuotesByCommercialStatus(
  savedQuotes: readonly SavedQuote[],
  filter: SavedQuoteCommercialFilter,
): SavedQuote[] {
  return savedQuotes.filter((quote) => filter === 'all' || quote.commercialStatus === filter);
}
