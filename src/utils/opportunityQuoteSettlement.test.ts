import { describe, expect, it } from 'vitest';
import type { Opportunity } from '../types/opportunity';
import { closeOpportunityForAcceptedQuote } from './opportunityQuoteSettlement';

const opportunity: Opportunity = {
  id: 'opportunity-1',
  clientId: 'client-1',
  name: 'Obra',
  address: '',
  estimatedStartDate: '',
  responsibleSeller: 'David',
  pipelineStage: 'proposal',
  commercialState: 'open',
  status: 'active',
  createdAt: '2026-10-26T10:00:00.000Z',
  updatedAt: '2026-10-26T10:00:00.000Z',
};

describe('accepted quote opportunity settlement', () => {
  it('moves the opportunity to won and cancels a pending send action', () => {
    const settled = closeOpportunityForAcceptedQuote(
      {
        ...opportunity,
        nextAction: {
          id: 'action-1',
          kind: 'sendQuote',
          type: 'other',
          description: 'Enviar presupuesto',
          dueAt: '2026-10-27T10:00:00.000Z',
          responsible: 'David',
          priority: 'medium',
          status: 'pending',
          createdAt: opportunity.createdAt,
          updatedAt: opportunity.updatedAt,
          history: [],
        },
      },
      'David',
      '2026-10-26T12:00:00.000Z',
    );

    expect(settled.pipelineStage).toBe('won');
    expect(settled.commercialState).toBe('won');
    expect(settled.status).toBe('closed');
    expect(settled.nextAction?.status).toBe('cancelled');
  });
});
