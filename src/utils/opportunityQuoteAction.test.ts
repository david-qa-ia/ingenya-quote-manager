import { describe, expect, it } from 'vitest';
import type { SavedQuote } from '../types/quote';
import { getOpportunityQuoteAction } from './opportunityQuoteAction';

function quote(overrides: Partial<SavedQuote> = {}): SavedQuote {
  return {
    id: 'quote-1',
    status: 'finalized',
    commercialStatus: 'prepared',
    commercialStatusAudit: {
      changedAt: '2026-10-26T10:00:00.000Z',
      changedBy: 'David',
      reason: 'Preparado',
    },
    clientName: 'Cliente',
    projectName: 'Obra',
    lines: [],
    savedAt: '2026-10-26T10:00:00.000Z',
    ...overrides,
  };
}

describe('opportunity quote action', () => {
  it('offers quote creation when the opportunity has no associated quotes', () => {
    expect(getOpportunityQuoteAction([])).toEqual({ type: 'create' });
  });

  it('continues the latest draft without treating it as a sent proposal', () => {
    const draft = quote({ id: 'quote-2', status: 'draft', version: 2 });

    expect(getOpportunityQuoteAction([quote({ commercialStatus: 'sent' }), draft])).toEqual({
      type: 'continueDraft',
      quote: draft,
    });
  });

  it('opens a finalized prepared quote so its send can be registered', () => {
    const prepared = quote();

    expect(getOpportunityQuoteAction([prepared])).toEqual({
      type: 'openPrepared',
      quote: prepared,
    });
  });

  it('shows a sent quote without creating a duplicate version', () => {
    const sent = quote({ commercialStatus: 'sent' });

    expect(getOpportunityQuoteAction([sent])).toEqual({ type: 'viewSent', quote: sent });
  });
});
