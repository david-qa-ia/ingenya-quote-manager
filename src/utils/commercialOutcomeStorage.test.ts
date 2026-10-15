import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appendCommercialOutcome, loadCommercialOutcomes } from './commercialOutcomeStorage';

const stored = new Map<string, string>();
const outcome = {
  id: 'outcome-1',
  type: 'lost' as const,
  reasonCode: 'price' as const,
  occurredAt: '2026-10-16T10:00:00.000Z',
  author: 'Daniel',
  origin: 'commercialPanel' as const,
  opportunityId: 'opportunity-1',
};

beforeEach(() => {
  stored.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('commercial outcome storage', () => {
  it('appends an outcome once and makes retries idempotent', () => {
    expect(appendCommercialOutcome(outcome)).toBe(true);
    expect(appendCommercialOutcome(outcome)).toBe(true);
    expect(loadCommercialOutcomes().items).toEqual([outcome]);
  });

  it('does not overwrite an unreadable collection after a partial failure', () => {
    stored.set('ingenya.commercialOutcomes.v1', '{bad');
    expect(appendCommercialOutcome(outcome)).toBe(false);
    expect(stored.get('ingenya.commercialOutcomes.v1')).toBe('{bad');
  });
});
