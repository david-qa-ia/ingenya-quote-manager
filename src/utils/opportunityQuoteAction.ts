import type { SavedQuote } from '../types/quote';

export type OpportunityQuoteAction =
  | { type: 'create' }
  | { type: 'continueDraft'; quote: SavedQuote }
  | { type: 'openPrepared'; quote: SavedQuote }
  | { type: 'viewSent'; quote: SavedQuote };

function compareQuotes(left: SavedQuote, right: SavedQuote): number {
  const versionDifference = (right.version ?? 1) - (left.version ?? 1);
  return versionDifference || Date.parse(right.savedAt) - Date.parse(left.savedAt);
}

/**
 * Selects the next quote action without inferring a commercial pipeline change.
 * A quote becomes a proposal only when its send is explicitly registered.
 */
export function getOpportunityQuoteAction(quotes: readonly SavedQuote[]): OpportunityQuoteAction {
  const currentQuote = [...quotes].sort(compareQuotes)[0];
  if (!currentQuote) return { type: 'create' };
  if (currentQuote.status === 'draft') return { type: 'continueDraft', quote: currentQuote };
  if (currentQuote.commercialStatus === 'prepared') {
    return { type: 'openPrepared', quote: currentQuote };
  }
  return { type: 'viewSent', quote: currentQuote };
}
