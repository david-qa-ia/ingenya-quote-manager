import { describe, expect, it } from 'vitest';
import type { SavedQuote } from '../types/quote';
import { canCreateQuoteVersion, collectQuoteVersions } from './quoteVersioning';

describe('quote versioning', () => {
  it('does not allow a new version after the quote has been accepted', () => {
    expect(canCreateQuoteVersion({ commercialStatus: 'accepted' })).toBe(false);
  });

  it('does not allow a new version for a won opportunity', () => {
    expect(
      canCreateQuoteVersion(
        { commercialStatus: 'sent' },
        { commercialState: 'won', pipelineStage: 'won' },
      ),
    ).toBe(false);
  });

  it('allows a new version for an active commercial opportunity', () => {
    expect(
      canCreateQuoteVersion(
        { commercialStatus: 'followingUp' },
        { commercialState: 'open', pipelineStage: 'proposal' },
      ),
    ).toBe(true);
  });
});

describe('collectQuoteVersions', () => {
  const quote = (id: string, basedOnQuoteId?: string) =>
    ({ id, basedOnQuoteId }) as unknown as SavedQuote;
  const quotes = [quote('v1'), quote('v2', 'v1'), quote('v3', 'v2'), quote('other')];
  const ids = (quoteId: string | null) => collectQuoteVersions(quotes, quoteId).map((q) => q.id);

  it('shows the version a quote came from and every version created after it', () => {
    expect(ids('v2')).toEqual(['v1', 'v2', 'v3']);
    expect(ids('v1')).toEqual(['v1', 'v2', 'v3']);
  });

  it('leaves out unrelated quotes and returns nothing for a missing quote', () => {
    expect(ids('other')).toEqual(['other']);
    expect(ids('missing')).toEqual([]);
    expect(ids(null)).toEqual([]);
  });
});
