import { describe, expect, it } from 'vitest';
import type { Client } from '../types/client';
import type { Opportunity } from '../types/opportunity';
import type { SavedQuote } from '../types/quote';
import { deriveGlobalSearchResults, isQuoteWithoutResponse } from './globalSearch';

const client: Client = {
  id: 'client-1',
  name: 'Laura Contreras',
  company: 'Constructech S.A.',
  phone: '+54 11 3718 2246',
  email: 'laura@constructech.com',
  preferredChannel: 'email',
  contactConsent: true,
  createdAt: '2024-04-12T00:00:00.000Z',
  updatedAt: '2024-04-12T00:00:00.000Z',
};
const opportunity: Opportunity = {
  id: 'op-1',
  clientId: client.id,
  name: 'Reforma local Fisherton',
  address: 'CABA',
  estimatedStartDate: '2024-04-30',
  responsibleSeller: 'David',
  createdAt: client.createdAt,
  updatedAt: client.updatedAt,
  qualification: {
    serviceOfInterest: 'Reforma local',
    interestLevel: 'high',
    detectedNeed: 'Obra',
    estimatedValue: 1000,
  },
};
const quote: SavedQuote = {
  id: 'PRES-1042',
  status: 'finalized',
  commercialStatus: 'sent',
  commercialStatusAudit: {
    changedAt: '2024-04-12T10:00:00.000Z',
    changedBy: 'David',
    reason: 'Enviado',
  },
  sentAudit: { changedAt: '2024-04-12T10:00:00.000Z', changedBy: 'David', reason: 'Enviado' },
  clientId: client.id,
  opportunityId: opportunity.id,
  clientName: client.name,
  projectName: opportunity.name,
  lines: [
    { id: 'line-1', name: 'Reforma', unit: 'unit', quantity: 1, unitPrice: 1000, source: 'manual' },
  ],
  version: 2,
  savedAt: '2024-04-12T10:00:00.000Z',
};

describe('global search', () => {
  it('matches normalized contact, opportunity and quote fields grouped by type', () => {
    const results = deriveGlobalSearchResults('fisherton', [client], [opportunity], [quote]);
    expect(results.map((result) => result.group).sort()).toEqual(
      ['opportunities', 'quotes'].sort(),
    );
    expect(deriveGlobalSearchResults('3718 2246', [client], [], [])[0]?.title).toBe(client.name);
  });

  it('flags a current sent quote only after seven calendar days', () => {
    const now = new Date('2024-04-19T10:01:00.000Z');
    expect(isQuoteWithoutResponse(quote, now)).toBe(true);
    expect(isQuoteWithoutResponse(quote, new Date('2024-04-19T09:59:59.000Z'))).toBe(false);
  });
});
