import { describe, expect, it } from 'vitest';
import type { CommercialOutcome } from '../types/commercialOutcome';
import type { Opportunity } from '../types/opportunity';
import {
  applyCommercialOutcome,
  getOpportunityCommercialState,
  commercialReasonLabels,
  formatLossReason,
  getLossReasonFieldErrors,
  isCommercialOutcome,
  lossReasonCodes,
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

  it('closes an accepted opportunity as won in the pipeline', () => {
    const won = applyCommercialOutcome(opportunity, accepted);
    expect(won.status).toBe('closed');
    expect(won.commercialState).toBe('won');
    expect(won.pipelineStage).toBe('won');
    expect(won.currentCommercialOutcomeId).toBe(accepted.id);
  });

  it('closes a lost opportunity in the lost pipeline stage', () => {
    const lost = applyCommercialOutcome(opportunity, {
      ...accepted,
      id: 'outcome-lost',
      type: 'lost',
      quoteId: undefined,
    });
    expect(lost.commercialState).toBe('lost');
    expect(lost.pipelineStage).toBe('lost');
    expect(lost.status).toBe('closed');
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

describe('loss reasons', () => {
  it('offers the short list: price, chose another, no answer, postponed, other', () => {
    expect(lossReasonCodes.map((code) => commercialReasonLabels[code])).toEqual([
      'Precio',
      'Eligió a otro',
      'No respondió',
      'Lo pospuso',
      'Otro',
    ]);
  });

  it('requires a reason, and a few words when it is "Otro"', () => {
    expect(getLossReasonFieldErrors({ code: '', detail: '' })).toEqual({
      code: 'Elegí el motivo de la pérdida.',
    });
    expect(getLossReasonFieldErrors({ code: 'other', detail: ' ' })).toEqual({
      detail: 'Contá brevemente el motivo.',
    });
    expect(getLossReasonFieldErrors({ code: 'postponed', detail: '' })).toEqual({});
  });

  it('saves the reason as readable text in the quote history', () => {
    expect(formatLossReason('price')).toBe('Precio');
    expect(formatLossReason('other', ' Se mudó ')).toBe('Otro: Se mudó');
  });

  it('keeps accepting outcomes saved with the earlier reasons', () => {
    const base = {
      id: 'o1',
      type: 'lost',
      occurredAt: '2026-11-09T12:00:00.000Z',
      author: 'Daniel',
      origin: 'commercialPanel',
      opportunityId: 'op1',
    };
    expect(isCommercialOutcome({ ...base, reasonCode: 'noBudget' })).toBe(true);
    expect(isCommercialOutcome({ ...base, reasonCode: 'postponed' })).toBe(true);
  });
});
