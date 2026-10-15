export type CommercialOutcomeType = 'accepted' | 'rejected' | 'lost' | 'reopened' | 'corrected';

export type CommercialReasonCode =
  | 'price'
  | 'noResponse'
  | 'choseAnotherProposal'
  | 'outOfScope'
  | 'noBudget'
  | 'timeline'
  | 'invalidData'
  | 'notInterested'
  | 'duplicate'
  | 'other';

export interface CommercialOutcome {
  id: string;
  type: CommercialOutcomeType;
  reasonCode?: CommercialReasonCode;
  note?: string;
  occurredAt: string;
  author: string;
  origin: 'manual' | 'commercialPanel';
  opportunityId: string;
  quoteId?: string;
  supersedesOutcomeId?: string;
}
