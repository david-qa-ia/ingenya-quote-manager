import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Quote, SavedQuote } from '../types/quote';
import {
  clearQuoteRecovery,
  isQuoteRecoveryUseful,
  loadQuoteRecovery,
  saveQuoteRecovery,
} from './quoteRecoveryStorage';

const draft: Quote = {
  id: 'PRES-2026-AAAA',
  status: 'draft',
  commercialStatus: 'prepared',
  commercialStatusAudit: { changedAt: '2026-11-04T05:00:00.000Z', changedBy: 'David', reason: '' },
  clientName: 'Distribuidora Sur',
  projectName: '',
  lines: [
    {
      id: 'line-1',
      name: 'Pintar pared',
      unit: 'squareMeter',
      quantity: 12.5,
      unitPrice: 30000,
      source: 'catalog',
    },
  ],
  version: 1,
};

const stored = new Map<string, string>();

describe('quote recovery (SCRUM-118)', () => {
  beforeEach(() => {
    stored.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
      removeItem: (key: string) => stored.delete(key),
    });
    vi.stubGlobal('sessionStorage', { getItem: () => null });
  });

  it('keeps the quote being built and gives it back after a reload', () => {
    saveQuoteRecovery(draft, new Date('2026-11-04T05:30:00.000Z'));
    const recovered = loadQuoteRecovery();
    expect(recovered).toMatchObject({ id: draft.id, savedAt: '2026-11-04T05:30:00.000Z' });
    expect(recovered?.lines[0].quantity).toBe(12.5);
    clearQuoteRecovery();
    expect(loadQuoteRecovery()).toBeNull();
  });

  it('ignores empty, finalized or corrupt copies', () => {
    saveQuoteRecovery({ ...draft, lines: [] });
    expect(loadQuoteRecovery()).toBeNull();
    saveQuoteRecovery({ ...draft, status: 'finalized' });
    expect(loadQuoteRecovery()).toBeNull();
    stored.set('ingenya.quoteRecovery.v1', '{"not":"a quote"');
    expect(loadQuoteRecovery()).toBeNull();
  });

  it('is only useful when it differs from what was saved', () => {
    const recovery: SavedQuote = { ...draft, savedAt: '2026-11-04T05:30:00.000Z' };
    expect(isQuoteRecoveryUseful(recovery, [])).toBe(true);
    expect(isQuoteRecoveryUseful(recovery, [{ ...recovery }])).toBe(false);
    expect(
      isQuoteRecoveryUseful(recovery, [
        { ...recovery, lines: [], savedAt: '2026-11-04T05:00:00Z' },
      ]),
    ).toBe(true);
    expect(isQuoteRecoveryUseful(recovery, [{ ...recovery, status: 'finalized' }])).toBe(false);
    expect(isQuoteRecoveryUseful(null, [])).toBe(false);
  });
});
