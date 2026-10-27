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
