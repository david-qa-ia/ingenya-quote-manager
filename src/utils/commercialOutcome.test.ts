import { describe, expect, it } from 'vitest';
import type { CommercialOutcome } from '../types/commercialOutcome';
import type { Opportunity } from '../types/opportunity';
import {
  applyCommercialOutcome,
  getOpportunityCommercialState,
  isCommercialOutcome,
} from './commercialOutcome';

const opportunity: Opportunity = {
  id: 'opportunity-1',
  clientId: 'client-1',
  name: 'Obra',
  address: '',
  estimatedStartDate: '',
  responsibleSeller: '',
  status: 'closed',
  createdAt: '2026-10-15T10:00:00.000Z',
  updatedAt: '2026-10-15T10:00:00.000Z',
};

const accepted: CommercialOutcome = {
  id: 'outcome-1',
  type: 'accepted',
  reasonCode: 'price',
  occurredAt: '2026-10-16T10:00:00.000Z',
  author: 'Daniel',
  origin: 'commercialPanel',
  opportunityId: opportunity.id,
  quoteId: 'quote-1',
};

describe('commercial outcomes', () => {
  it('accepts only the approved reason codes and requires a note for other', () => {
    expect(isCommercialOutcome(accepted)).toBe(true);
    expect(isCommercialOutcome({ ...accepted, reasonCode: 'invented' })).toBe(false);
    expect(isCommercialOutcome({ ...accepted, reasonCode: 'other', note: ' ' })).toBe(false);
    expect(
      isCommercialOutcome({ ...accepted, reasonCode: 'other', note: 'Competidor local' }),
    ).toBe(true);
  });

  it('sets commercial state without mapping the pre-existing operational status', () => {
    const won = applyCommercialOutcome(opportunity, accepted);
    expect(won.status).toBe('closed');
    expect(won.commercialState).toBe('won');
    expect(won.currentCommercialOutcomeId).toBe(accepted.id);
  });

  it('models loss, reopening and corrections without mutating the previous event', () => {
    const lost = { ...accepted, id: 'outcome-2', type: 'lost' as const, quoteId: undefined };
    const reopened = { ...lost, id: 'outcome-3', type: 'reopened' as const };
    const corrected = {
      ...lost,
      id: 'outcome-4',
      type: 'corrected' as const,
      supersedesOutcomeId: lost.id,
    };
    expect(getOpportunityCommercialState(lost)).toBe('lost');
    expect(getOpportunityCommercialState(reopened)).toBe('open');
    expect(isCommercialOutcome(corrected)).toBe(true);
    expect(lost.supersedesOutcomeId).toBeUndefined();
  });
});
