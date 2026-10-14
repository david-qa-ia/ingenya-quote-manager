import { describe, expect, it } from 'vitest';
import type { Client } from '../types/client';
import type { Opportunity } from '../types/opportunity';
import type { Quote } from '../types/quote';
import { associateQuote } from './quoteAssociations';
import { prepareQuotePdfModel } from './quotePdfModel';

const client: Client = {
  id: 'client',
  name: 'Cliente actual',
  phone: '1111111111',
  email: 'none',
  preferredChannel: '',
  contactConsent: false,
  createdAt: '2026-10-14T00:00:00Z',
  updatedAt: '2026-10-14T00:00:00Z',
};
const opportunity: Opportunity = {
  id: 'opportunity',
  clientId: client.id,
  name: 'Oportunidad actual',
  address: '',
  estimatedStartDate: '',
  responsibleSeller: '',
  createdAt: client.createdAt,
  updatedAt: client.updatedAt,
};
const quote: Quote = {
  id: 'quote',
  status: 'draft',
  clientName: 'Cliente histórico',
  projectName: 'Obra histórica',
  lines: [
    { id: 'line', name: 'Servicio', unit: 'unit', quantity: 1, unitPrice: 0, source: 'manual' },
  ],
};

describe('quote associations', () => {
  it('takes initial snapshots without changing identity, lines or status', () => {
    const result = associateQuote(quote, client, opportunity, false);
    expect(result).toEqual({
      ...quote,
      clientId: client.id,
      opportunityId: opportunity.id,
      clientName: client.name,
      projectName: opportunity.name,
    });
    expect(quote.clientName).toBe('Cliente histórico');
  });
  it('preserves historical snapshots and PDF model when manually linking or unlinking a saved draft', () => {
    const linked = associateQuote(quote, client, opportunity, true);
    expect(linked.clientName).toBe(quote.clientName);
    expect(linked.projectName).toBe(quote.projectName);
    expect(prepareQuotePdfModel(linked)).toEqual(prepareQuotePdfModel(quote));
    const unlinked = associateQuote(linked, undefined, undefined, true);
    expect(unlinked.clientId).toBeUndefined();
    expect(unlinked.opportunityId).toBeUndefined();
    expect(unlinked.clientName).toBe(quote.clientName);
  });
  it('allows client-only drafts and clears an opportunity when changing client', () => {
    expect(associateQuote(quote, client, undefined, false).opportunityId).toBeUndefined();
    expect(
      associateQuote(
        { ...quote, opportunityId: opportunity.id },
        { ...client, id: 'other' },
        undefined,
        true,
      ).opportunityId,
    ).toBeUndefined();
  });
  it('rejects an opportunity without its matching client and any change to finalized quotes', () => {
    expect(() => associateQuote(quote, undefined, opportunity, false)).toThrow();
    expect(() => associateQuote(quote, { ...client, id: 'other' }, opportunity, false)).toThrow();
    expect(() =>
      associateQuote({ ...quote, status: 'finalized' }, client, opportunity, true),
    ).toThrow();
  });
});
