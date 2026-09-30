import type { QuoteStatus, SavedQuote } from '../types/quote';

export type SavedQuoteFilter = 'all' | QuoteStatus;

export function filterSavedQuotes(
  savedQuotes: readonly SavedQuote[],
  filter: SavedQuoteFilter,
): SavedQuote[] {
  return savedQuotes.filter((quote) => filter === 'all' || quote.status === filter);
}
