import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuoteDraft } from '../types/quote';
import {
  loadSavedQuotes,
  parseSavedQuotes,
  SAVED_QUOTES_STORAGE_KEY,
  saveQuoteDraft,
} from './quoteDraftStorage';

const validDraft: QuoteDraft = {
  id: 'PRES-2026-0001',
  status: 'draft',
  clientName: 'Ana Pérez',
  projectName: 'Reforma cocina',
  lines: [
    {
      id: 'line-1',
      catalogJobId: 'paint-wall',
      name: 'Pintar pared',
      description: 'Preparación y dos manos',
      unit: 'squareMeter',
      quantity: 12.5,
      unitPrice: 15000,
      source: 'catalog',
    },
  ],
};

const validSavedQuote = {
  ...validDraft,
  savedAt: '2026-09-28T12:00:00.000Z',
};

describe('parseSavedQuotes', () => {
  it('returns a valid collection of saved quotes', () => {
    expect(parseSavedQuotes(JSON.stringify([validSavedQuote]))).toEqual([validSavedQuote]);
  });

  it('returns an empty collection when no stored value exists', () => {
    expect(parseSavedQuotes(null)).toEqual([]);
  });

  it('returns an empty collection when the stored value is malformed JSON', () => {
    expect(parseSavedQuotes('{not-valid-json')).toEqual([]);
  });

  it('returns an empty collection when the stored value is not an array', () => {
    expect(parseSavedQuotes(JSON.stringify(validSavedQuote))).toEqual([]);
  });

  it('ignores corrupt quotes while keeping valid entries', () => {
    const corruptQuote = { ...validSavedQuote, id: 'corrupt', lines: [{ quantity: -1 }] };

    expect(parseSavedQuotes(JSON.stringify([corruptQuote, validSavedQuote]))).toEqual([
      validSavedQuote,
    ]);
  });

  it('accepts a saved quote with empty optional client and project data', () => {
    const emptySavedQuote = {
      ...validSavedQuote,
      clientName: '',
      projectName: '',
      lines: [],
    };

    expect(parseSavedQuotes(JSON.stringify([emptySavedQuote]))).toEqual([emptySavedQuote]);
  });

  it('accepts finalized quotes and unit prices equal to zero', () => {
    const finalizedQuote = {
      ...validSavedQuote,
      status: 'finalized',
      lines: [{ ...validSavedQuote.lines[0], unitPrice: 0 }],
    };

    expect(parseSavedQuotes(JSON.stringify([finalizedQuote]))).toEqual([finalizedQuote]);
  });

  it('keeps historical quote lines valid when they do not have a description', () => {
    const historicalQuote = {
      ...validSavedQuote,
      lines: [{ ...validSavedQuote.lines[0], description: undefined }],
    };
    expect(parseSavedQuotes(JSON.stringify([historicalQuote]))).toHaveLength(1);
  });

  it('rejects unsupported statuses and finalized quotes without lines', () => {
    const unsupportedQuote = { ...validSavedQuote, status: 'sent' };
    const emptyFinalizedQuote = { ...validSavedQuote, status: 'finalized', lines: [] };

    expect(parseSavedQuotes(JSON.stringify([unsupportedQuote, emptyFinalizedQuote]))).toEqual([]);
  });
});

describe('saved quote storage', () => {
  const storedValues = new Map<string, string>();

  beforeEach(() => {
    storedValues.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storedValues.get(key) ?? null,
      setItem: (key: string, value: string) => storedValues.set(key, value),
    });
  });

  it('saves multiple quotes in the collection', () => {
    const secondDraft = { ...validDraft, id: 'PRES-2026-0002' };

    expect(saveQuoteDraft(validDraft)).toBe(true);
    expect(saveQuoteDraft(secondDraft)).toBe(true);
    expect(loadSavedQuotes().map((quote) => quote.id)).toEqual([validDraft.id, secondDraft.id]);
  });

  it('updates a saved quote by id instead of duplicating it', () => {
    expect(saveQuoteDraft(validDraft)).toBe(true);
    expect(saveQuoteDraft({ ...validDraft, clientName: 'Cliente actualizado' })).toBe(true);

    expect(loadSavedQuotes()).toHaveLength(1);
    expect(loadSavedQuotes()[0].clientName).toBe('Cliente actualizado');
  });

  it('persists and recovers a finalized quote', () => {
    expect(saveQuoteDraft({ ...validDraft, status: 'finalized' })).toBe(true);

    expect(loadSavedQuotes()[0].status).toBe('finalized');
  });

  it('does not persist a derived total', () => {
    const draftWithDerivedTotal = { ...validDraft, total: 999999 };

    expect(saveQuoteDraft(draftWithDerivedTotal)).toBe(true);

    const storedValue = storedValues.get(SAVED_QUOTES_STORAGE_KEY);
    expect(storedValue).toBeDefined();
    expect(JSON.parse(storedValue ?? '[]')[0]).not.toHaveProperty('total');
  });
});
