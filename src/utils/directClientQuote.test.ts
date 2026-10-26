import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Quote } from '../types/quote';
import { loadClients, saveClient } from './clientStorage';
import { convertDirectQuoteToOpportunity } from './directQuoteConversion';
import { saveDirectClientQuote } from './directClientQuote';
import { loadOpportunities } from './opportunityStorage';
import { loadSavedQuotes } from './quoteDraftStorage';

const records = new Map<string, string>();
let fail = false;
beforeEach(() => {
  records.clear();
  fail = false;
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => records.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (fail) throw new Error('blocked');
      records.set(key, value);
    },
    removeItem: (key: string) => records.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());

function quote(): Quote {
  return {
    id: 'quote-direct',
    status: 'draft',
    commercialStatus: 'prepared',
    commercialStatusAudit: {
      changedAt: '2026-10-22T12:00:00Z',
      changedBy: 'Sistema local',
      reason: 'Creado.',
    },
    clientName: '',
    projectName: 'Reforma',
    lines: [
      { id: 'line', name: 'Pintura', unit: 'unit', quantity: 1, unitPrice: 10, source: 'manual' },
    ],
  };
}

describe('direct client quote transaction', () => {
  it('creates a direct client and quote together, allowing missing phone and email', () => {
    const result = saveDirectClientQuote(quote(), {
      name: 'Ana',
      company: '',
      phone: '',
      email: '',
      projectName: '',
    });
    expect(result.ok).toBe(true);
    expect(loadClients().items).toHaveLength(1);
    expect(loadSavedQuotes()).toHaveLength(1);
    expect(loadSavedQuotes()[0].clientId).toBe(loadClients().items[0].id);
  });
  it('does not leave a client when the compound write fails', () => {
    fail = true;
    const result = saveDirectClientQuote(quote(), {
      name: 'Ana',
      company: '',
      phone: '',
      email: '',
      projectName: '',
    });
    expect(result.ok).toBe(false);
    fail = false;
    expect(loadClients().items).toEqual([]);
    expect(loadSavedQuotes()).toEqual([]);
  });
  it('creates one follow-up only when it is explicitly requested', () => {
    const result = saveDirectClientQuote(
      quote(),
      { name: 'Ana', company: '', phone: '', email: '', projectName: 'Reforma' },
      { dueAt: '2026-10-25T12:00', channel: 'call', responsible: 'David' },
    );
    expect(result.ok).toBe(true);
    expect(loadOpportunities().items).toHaveLength(1);
    expect(loadOpportunities().items[0].nextAction?.description).toBe(
      'Dar seguimiento al presupuesto',
    );
    expect(loadSavedQuotes()[0].opportunityId).toBe(loadOpportunities().items[0].id);
  });
  it('reuses the selected client and preserves opportunity traceability', () => {
    const now = '2026-10-24T12:00:00.000Z';
    const client = {
      id: 'client-existing',
      name: 'Nestor',
      company: 'Chocolates Agostino',
      phone: '3417777777',
      email: 'nestor@example.com',
      preferredChannel: '',
      contactConsent: false,
      createdAt: now,
      updatedAt: now,
    } as const;
    expect(saveClient(client)).toBe(true);

    const result = saveDirectClientQuote(
      quote(),
      {
        existingClientId: client.id,
        name: client.name,
        company: client.company,
        phone: client.phone,
        email: client.email,
        projectName: 'Local centro',
        origin: 'Instagram',
        serviceOfInterest: 'Automatización',
        observations: 'Pidió cotización esta semana.',
      },
      { dueAt: '2026-10-25T12:00', channel: 'whatsapp', responsible: 'David' },
    );

    expect(result.ok).toBe(true);
    expect(loadClients().items).toHaveLength(1);
    expect(loadOpportunities().items[0]).toMatchObject({
      clientId: client.id,
      origin: 'Instagram',
      qualification: {
        serviceOfInterest: 'Automatización',
        detectedNeed: 'Pidió cotización esta semana.',
      },
    });
  });
  it('converts a saved direct quote only once and preserves the quote', () => {
    const created = saveDirectClientQuote(quote(), {
      name: 'Ana',
      company: '',
      phone: '',
      email: '',
      projectName: '',
    });
    if (!created.ok) throw new Error('setup');
    const saved = loadSavedQuotes()[0];
    const result = convertDirectQuoteToOpportunity(saved);
    expect(result.ok).toBe(true);
    expect(loadOpportunities().items).toHaveLength(1);
    expect(loadSavedQuotes()[0].opportunityId).toBe(loadOpportunities().items[0].id);
    expect(convertDirectQuoteToOpportunity(loadSavedQuotes()[0]).ok).toBe(false);
  });
});
