import { describe, expect, it } from 'vitest';
import type { Client } from '../types/client';
import type { Opportunity } from '../types/opportunity';
import type { SavedQuote } from '../types/quote';
import type { Prospect } from '../types/prospect';
import { deriveGlobalSearchResults, isQuoteWithoutResponse } from './globalSearch';
import { searchShortcutLabel } from './searchShortcut';

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

  it('labels an opportunity with its stage in Trabajos, never the internal stage word', () => {
    const stored = { ...opportunity, pipelineStage: 'opportunity' as const };
    const withoutQuote = deriveGlobalSearchResults('fisherton', [client], [stored], [])[0];
    expect(withoutQuote?.context).toBe('Presupuestando · Constructech S.A.');
    const withSentQuote = deriveGlobalSearchResults('fisherton', [client], [stored], [quote]).find(
      (result) => result.group === 'opportunities',
    );
    expect(withSentQuote?.context).toBe('Presupuesto enviado · Constructech S.A.');
  });

  it('flags a current sent quote only after seven calendar days', () => {
    const now = new Date('2024-04-19T10:01:00.000Z');
    expect(isQuoteWithoutResponse(quote, now)).toBe(true);
    expect(isQuoteWithoutResponse(quote, new Date('2024-04-19T09:59:59.000Z'))).toBe(false);
  });
});

describe('global search for prospects (SCRUM-117)', () => {
  const prospect: Prospect = {
    id: 'prospect-ana',
    name: 'Ana Gómez',
    company: 'Pinturerías 2000',
    phone: '+54 9 341 555-9876',
    email: 'ana@pinturerias.com',
    source: '',
    potentialService: '',
    notes: '',
    status: 'uncontacted',
    priority: 'medium',
    priorityReason: 'Manual',
    nextAction: '',
    nextActionAt: '',
    responsible: '',
    preferredChannel: '',
    activities: [],
    createdAt: '2026-11-04T00:00:00Z',
    updatedAt: '2026-11-04T00:00:00Z',
  };
  const search = (query: string, prospects: Prospect[] = [prospect]) =>
    deriveGlobalSearchResults(query, [], [], [], prospects);

  it.each(['ana', 'gomez', 'Gómez', 'pint', 'Pinturerías 2000', '341 555', '3415559876', 'ana@'])(
    'finds the prospect with %j',
    (query) => {
      expect(search(query)[0]?.prospect?.id).toBe('prospect-ana');
      expect(search(query)[0]?.group).toBe('prospects');
    },
  );

  it('does not match unrelated text or digits', () => {
    expect(search('laura')).toEqual([]);
    expect(search('999 000')).toEqual([]);
  });

  it('skips converted prospects, which already appear as clients', () => {
    const converted = { ...prospect, conversion: {} } as unknown as Prospect;
    expect(search('ana', [converted])).toEqual([]);
  });

  it('marks archived prospects in the context', () => {
    expect(
      search('ana', [{ ...prospect, archivedAt: '2026-11-04T00:00:00Z' }])[0]?.context,
    ).toContain('Archivado');
  });
});

describe('searchShortcutLabel', () => {
  it('uses ⌘ on Apple devices and Ctrl elsewhere', () => {
    expect(searchShortcutLabel('MacIntel Mozilla/5.0 (Macintosh)')).toBe('⌘ K');
    expect(searchShortcutLabel('Win32 Mozilla/5.0 (Windows NT 10.0)')).toBe('Ctrl K');
    expect(searchShortcutLabel('Linux x86_64 Mozilla/5.0 (X11; Linux)')).toBe('Ctrl K');
  });
});
