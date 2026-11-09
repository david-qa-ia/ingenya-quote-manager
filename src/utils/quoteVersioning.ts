import type { Opportunity } from '../types/opportunity';
import type { SavedQuote } from '../types/quote';

export function canCreateQuoteVersion(
  quote: Pick<SavedQuote, 'commercialStatus'>,
  opportunity?: Pick<Opportunity, 'commercialState' | 'pipelineStage'>,
): boolean {
  return (
    quote.commercialStatus !== 'accepted' &&
    opportunity?.commercialState !== 'won' &&
    opportunity?.pipelineStage !== 'won'
  );
}

/**
 * The versions shown in a quote detail: the quote, every version created from it (and from
 * those, recursively) and the version it was created from.
 */
export function collectQuoteVersions(
  quotes: readonly SavedQuote[],
  quoteId: string | null,
): SavedQuote[] {
  const quote = quotes.find((item) => item.id === quoteId);
  if (!quote) return [];
  const versionIds = new Set<string>([quote.id]);
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const item of quotes) {
      if (item.basedOnQuoteId && versionIds.has(item.basedOnQuoteId) && !versionIds.has(item.id)) {
        versionIds.add(item.id);
        expanded = true;
      }
      if (item.id === quote.id && item.basedOnQuoteId && !versionIds.has(item.basedOnQuoteId)) {
        versionIds.add(item.basedOnQuoteId);
        expanded = true;
      }
    }
  }
  return quotes.filter((item) => versionIds.has(item.id));
}
