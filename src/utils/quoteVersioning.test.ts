import { describe, expect, it } from 'vitest';
import { canCreateQuoteVersion } from './quoteVersioning';

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
