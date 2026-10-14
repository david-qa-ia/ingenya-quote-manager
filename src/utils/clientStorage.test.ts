import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '../types/client';
import { CLIENTS_STORAGE_KEY, loadClients, saveClient } from './clientStorage';
import {
  OPPORTUNITIES_STORAGE_KEY,
  loadOpportunities,
  saveOpportunity,
} from './opportunityStorage';
import {
  loadSavedQuotes,
  parseSavedQuotes,
  SAVED_QUOTES_STORAGE_KEY,
  saveQuote,
} from './quoteDraftStorage';
import { finalizeQuote } from './quoteFinalization';
import type { Quote } from '../types/quote';

const client: Client = {
  id: 'client',
  name: 'Ana',
  phone: '1111111111',
  email: 'none',
  preferredChannel: '',
  contactConsent: false,
  createdAt: '2026-10-14T00:00:00Z',
  updatedAt: '2026-10-14T00:00:00Z',
};
const opportunity = {
  id: 'opportunity',
  clientId: client.id,
  name: 'Reforma',
  address: '',
  estimatedStartDate: '',
  responsibleSeller: '',
  createdAt: client.createdAt,
  updatedAt: client.updatedAt,
};
const quote: Quote = {
  id: 'quote',
  status: 'draft',
  commercialStatus: 'prepared',
  commercialStatusAudit: {
    changedAt: '2026-10-14T00:00:00Z',
    changedBy: 'Sistema local',
    reason: 'Estado comercial inicial al crear el presupuesto.',
  },
  clientName: 'Ana histórica',
  projectName: 'Obra histórica',
  lines: [
    { id: 'line', name: 'Servicio', unit: 'unit', quantity: 1, unitPrice: 10, source: 'manual' },
  ],
};
const stored = new Map<string, string>();
beforeEach(() => {
  stored.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('commercial persistence and quote compatibility', () => {
  it('loads missing collections without writing or generating entities', () => {
    expect(loadClients()).toEqual({ items: [], issue: null });
    expect(loadOpportunities()).toEqual({ items: [], issue: null });
    expect(stored.size).toBe(0);
  });
  it('keeps separate identities with identical names and contacts and updates only by id', () => {
    expect(saveClient(client)).toBe(true);
    expect(saveClient({ ...client, id: 'second' })).toBe(true);
    expect(saveClient({ ...client, name: 'Updated' })).toBe(true);
    expect(loadClients().items.map((item) => item.name)).toEqual(['Updated', 'Ana']);
  });
  it('requires an existing client and prevents moving an existing opportunity to another client', () => {
    expect(saveOpportunity(opportunity)).toBe(false);
    saveClient(client);
    expect(saveOpportunity(opportunity)).toBe(true);
    saveClient({ ...client, id: 'other' });
    expect(saveOpportunity({ ...opportunity, clientId: 'other' })).toBe(false);
  });
  it('keeps multiple quotes in one opportunity independent through save, reopen and finalization', () => {
    saveClient(client);
    saveOpportunity(opportunity);
    const linked = { ...quote, clientId: client.id, opportunityId: opportunity.id };
    expect(saveQuote(linked)).toBe(true);
    expect(saveQuote({ ...linked, id: 'second' })).toBe(true);
    expect(saveQuote(finalizeQuote(linked))).toBe(true);
    expect(loadSavedQuotes().map((item) => [item.id, item.status, item.opportunityId])).toEqual([
      ['quote', 'finalized', opportunity.id],
      ['second', 'draft', opportunity.id],
    ]);
    expect(loadSavedQuotes()[0].clientId).toBe(client.id);
    const snapshot = stored.get(SAVED_QUOTES_STORAGE_KEY);
    saveClient({ ...client, name: 'Renamed' });
    saveOpportunity({
      ...opportunity,
      name: 'Renamed opportunity',
      responsibleSeller: 'Otro vendedor',
    });
    expect(stored.get(SAVED_QUOTES_STORAGE_KEY)).toBe(snapshot);
  });
  it('never updates an existing finalized quote, even to add associations or revert to draft', () => {
    saveQuote(finalizeQuote(quote));
    const snapshot = stored.get(SAVED_QUOTES_STORAGE_KEY);
    expect(saveQuote({ ...finalizeQuote(quote), clientId: client.id })).toBe(false);
    expect(saveQuote(quote)).toBe(false);
    expect(stored.get(SAVED_QUOTES_STORAGE_KEY)).toBe(snapshot);
  });
  it('normalizes old and partially invalid references idempotently without changing historical data or writing', () => {
    const historical = { ...quote, savedAt: client.createdAt };
    const invalidReferences = {
      ...historical,
      id: 'invalid-refs',
      clientId: 123,
      opportunityId: '',
    };
    const orphan = {
      ...historical,
      id: 'orphan',
      clientId: 'missing-client',
      opportunityId: 'missing-opportunity',
    };
    const raw = JSON.stringify([historical, invalidReferences, orphan]);
    stored.set(SAVED_QUOTES_STORAGE_KEY, raw);
    const once = loadSavedQuotes();
    expect(parseSavedQuotes(JSON.stringify(once))).toEqual(once);
    expect(loadSavedQuotes()).toEqual(once);
    expect(once[0]).toEqual(historical);
    expect(once[1]).not.toHaveProperty('clientId');
    expect(once[2]).toEqual(orphan);
    expect(stored.get(SAVED_QUOTES_STORAGE_KEY)).toBe(raw);
    expect(stored.has(CLIENTS_STORAGE_KEY)).toBe(false);
    expect(stored.has(OPPORTUNITIES_STORAGE_KEY)).toBe(false);
  });
  it.each(['{broken', '{}'])('preserves corrupt roots and refuses writes: %s', (raw) => {
    for (const key of [CLIENTS_STORAGE_KEY, OPPORTUNITIES_STORAGE_KEY, SAVED_QUOTES_STORAGE_KEY])
      stored.set(key, raw);
    expect(loadClients().issue).toBe('invalid-root');
    expect(loadOpportunities().issue).toBe('invalid-root');
    expect(saveClient(client)).toBe(false);
    expect(saveOpportunity(opportunity)).toBe(false);
    expect(saveQuote(quote)).toBe(false);
    expect([...stored.values()]).toEqual([raw, raw, raw]);
  });
  it('recovers valid records and preserves unrelated invalid entries on subsequent writes', () => {
    const invalid = { id: 'broken', name: 42 };
    stored.set(CLIENTS_STORAGE_KEY, JSON.stringify([invalid, client]));
    expect(loadClients()).toEqual({ items: [client], issue: 'invalid-entries' });
    expect(saveClient({ ...client, name: 'Updated' })).toBe(true);
    expect(JSON.parse(stored.get(CLIENTS_STORAGE_KEY)!)[0]).toEqual(invalid);
    stored.set(
      SAVED_QUOTES_STORAGE_KEY,
      JSON.stringify([invalid, { ...quote, savedAt: client.createdAt }]),
    );
    expect(saveQuote({ ...quote, id: 'second' })).toBe(true);
    expect(loadSavedQuotes()).toHaveLength(2);
    expect(JSON.parse(stored.get(SAVED_QUOTES_STORAGE_KEY)!)[0]).toEqual(invalid);
  });
  it('does not silently overwrite ambiguous duplicate identities', () => {
    stored.set(CLIENTS_STORAGE_KEY, JSON.stringify([client, client]));
    expect(loadClients().items).toHaveLength(1);
    expect(loadClients().issue).toBe('invalid-entries');
    expect(saveClient(client)).toBe(false);
    stored.set(
      SAVED_QUOTES_STORAGE_KEY,
      JSON.stringify([
        { ...quote, savedAt: client.createdAt },
        { ...quote, savedAt: client.createdAt },
      ]),
    );
    expect(loadSavedQuotes()).toHaveLength(1);
    expect(saveQuote(quote)).toBe(false);
  });
  it('reports read and write failures without replacing stored data', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: vi.fn(),
    });
    expect(loadClients().issue).toBe('unavailable');
    expect(saveClient(client)).toBe(false);
    expect(saveQuote(quote)).toBe(false);
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
    });
    expect(saveClient(client)).toBe(false);
    expect(saveQuote(quote)).toBe(false);
  });
  it('serializes only approved client and opportunity fields', () => {
    saveClient({ ...client, extra: 'derived' } as Client);
    saveOpportunity({ ...opportunity, total: 100 } as typeof opportunity);
    expect(JSON.parse(stored.get(CLIENTS_STORAGE_KEY)!)[0]).not.toHaveProperty('extra');
    expect(JSON.parse(stored.get(OPPORTUNITIES_STORAGE_KEY)!)[0]).not.toHaveProperty('total');
  });
});
