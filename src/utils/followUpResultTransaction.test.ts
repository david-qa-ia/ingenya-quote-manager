import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  commitLocalFollowUpResult,
  followUpResultRecoveryMessage,
} from './followUpResultTransaction';

const stored = new Map<string, string>();
let failedKey: string | null = null;

beforeEach(() => {
  stored.clear();
  failedKey = null;
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (key === failedKey) throw new Error('storage unavailable');
      stored.set(key, value);
    },
    removeItem: (key: string) => {
      if (key === failedKey) throw new Error('storage unavailable');
      stored.delete(key);
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('local follow-up result transaction', () => {
  it('rolls back an opportunity when its activity fails after the opportunity was saved', () => {
    stored.set('opportunities', 'before-opportunity');
    stored.set('activities', 'before-activity');

    const result = commitLocalFollowUpResult(
      ['opportunities', 'activities'],
      [
        () => {
          stored.set('opportunities', 'completed-with-next-action');
          return true;
        },
        () => false,
      ],
    );

    expect(result).toEqual({ ok: false });
    expect(stored.get('opportunities')).toBe('before-opportunity');
    expect(stored.get('activities')).toBe('before-activity');
  });

  it('rolls back the cadence when its linked opportunity cannot be updated', () => {
    stored.set('cadences', 'before-cadence');
    stored.set('opportunities', 'before-opportunity');

    const result = commitLocalFollowUpResult(
      ['cadences', 'opportunities', 'activities'],
      [
        () => {
          stored.set('cadences', 'advanced');
          return true;
        },
        () => false,
      ],
    );

    expect(result).toEqual({ ok: false });
    expect(stored.get('cadences')).toBe('before-cadence');
    expect(stored.get('opportunities')).toBe('before-opportunity');
  });

  it('allows a later retry after rollback without duplicating a state change or activity', () => {
    stored.set('opportunities', 'before');
    stored.set('activities', 'before');
    let attempts = 0;
    const writes = [
      () => {
        attempts += 1;
        stored.set('opportunities', 'completed-once');
        return true;
      },
      () => {
        if (attempts === 1) return false;
        stored.set('activities', 'one-history-entry');
        return true;
      },
    ];

    expect(commitLocalFollowUpResult(['opportunities', 'activities'], writes)).toEqual({
      ok: false,
    });
    expect(commitLocalFollowUpResult(['opportunities', 'activities'], writes)).toEqual({
      ok: true,
    });
    expect(stored.get('opportunities')).toBe('completed-once');
    expect(stored.get('activities')).toBe('one-history-entry');
  });

  it('commits state, next action and history together on complete success', () => {
    const result = commitLocalFollowUpResult(
      ['opportunities', 'activities'],
      [
        () => {
          stored.set('opportunities', 'completed-with-one-next-action');
          return true;
        },
        () => {
          stored.set('activities', 'one-history-entry');
          return true;
        },
      ],
    );

    expect(result).toEqual({ ok: true });
    expect(stored.get('opportunities')).toBe('completed-with-one-next-action');
    expect(stored.get('activities')).toBe('one-history-entry');
  });

  it('returns an explicit recovery result when rollback cannot be verified', () => {
    stored.set('opportunities', 'before');
    stored.set('activities', 'before');
    const result = commitLocalFollowUpResult(
      ['opportunities', 'activities'],
      [
        () => {
          localStorage.setItem('opportunities', 'primary-persisted');
          failedKey = 'activities';
          return true;
        },
        () => false,
      ],
    );

    expect(result).toEqual({
      ok: false,
      recoveryRequired: true,
      message: followUpResultRecoveryMessage,
    });
  });
});
