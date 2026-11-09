import { useCallback, useState } from 'react';
import type { Opportunity } from '../types/opportunity';
import { recordNextActionActivity } from './activityStorage';
import {
  closeOpportunityForAcceptedQuote,
  closeOpportunityForRejectedQuote,
} from './opportunityQuoteSettlement';
import { loadOpportunities, saveOpportunity } from './opportunityStorage';
import { loadProspects } from './prospectStorage';
import { loadSavedQuotes } from './quoteDraftStorage';

export const PROSPECTS_UPDATED_EVENT = 'ventro:prospects-updated';

/**
 * On load, an opportunity whose latest settled quote was accepted or rejected is closed as won
 * or lost if a previous save left it open, so the list never shows it as pending.
 */
function loadOpportunitiesWithSettledQuoteRepair(): Opportunity[] {
  const settledQuotes = loadSavedQuotes().filter(
    (quote) =>
      (quote.commercialStatus === 'accepted' || quote.commercialStatus === 'rejected') &&
      quote.opportunityId,
  );
  loadOpportunities().items.forEach((opportunity) => {
    const settledQuote = settledQuotes
      .filter((quote) => quote.opportunityId === opportunity.id)
      .sort(
        (left, right) =>
          Date.parse(right.commercialStatusAudit.changedAt) -
          Date.parse(left.commercialStatusAudit.changedAt),
      )[0];
    if (!settledQuote) return;
    const isAccepted = settledQuote.commercialStatus === 'accepted';
    const needsRepair =
      opportunity.pipelineStage !== (isAccepted ? 'won' : 'lost') ||
      opportunity.commercialState !== (isAccepted ? 'won' : 'lost') ||
      opportunity.status !== 'closed' ||
      opportunity.nextAction?.status === 'pending';
    if (!needsRepair) return;
    const next = (isAccepted ? closeOpportunityForAcceptedQuote : closeOpportunityForRejectedQuote)(
      opportunity,
      settledQuote.commercialStatusAudit.changedBy,
      settledQuote.commercialStatusAudit.changedAt,
    );
    if (!saveOpportunity(next)) return;
    if (opportunity.nextAction?.status === 'pending' && next.nextAction)
      recordNextActionActivity(
        next.id,
        next.nextAction.id,
        'cancelled',
        `Próximo paso cancelado porque el presupuesto fue ${isAccepted ? 'aceptado' : 'rechazado'}.`,
      );
  });
  return loadOpportunities().items;
}

/** Opportunities and prospects as the browser copy has them. */
export function useCommercialRecords() {
  const [opportunities, setOpportunities] = useState(loadOpportunitiesWithSettledQuoteRepair);
  const [prospects, setProspects] = useState(() => loadProspects().items);

  /** Read the opportunities again after a save, a sync or a workspace change. */
  const reloadOpportunities = useCallback(() => setOpportunities(loadOpportunities().items), []);

  /** Read the prospects again and tell the open prospect screens to refresh. */
  const reloadProspects = useCallback(() => {
    setProspects(loadProspects().items);
    window.dispatchEvent(new Event(PROSPECTS_UPDATED_EVENT));
  }, []);

  return { opportunities, reloadOpportunities, prospects, setProspects, reloadProspects };
}
