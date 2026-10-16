import { describe, expect, it } from 'vitest';
import {
  getLocalDateKey,
  getLocalDateKeyFromFollowUp,
  isoToLocalDateTime,
  localDateTimeToIso,
} from './prospectFollowUp';

describe('prospect follow-up dates', () => {
  it('persists a datetime-local value as a complete ISO instant and restores it locally', () => {
    const result = localDateTimeToIso('2026-10-17T10:00');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:00:00\.000Z$/);
    expect(isoToLocalDateTime(result.value)).toBe('2026-10-17T10:00');
  });
  it('rejects empty and impossible local dates', () => {
    expect(localDateTimeToIso('').ok).toBe(false);
    expect(localDateTimeToIso('2026-02-30T10:00').ok).toBe(false);
  });
  it('uses the user local date when grouping an ISO follow-up', () => {
    const result = localDateTimeToIso('2026-10-17T10:00');
    if (!result.ok) throw new Error(result.error);
    expect(getLocalDateKeyFromFollowUp(result.value)).toBe(getLocalDateKey(new Date(2026, 9, 17)));
  });
});
