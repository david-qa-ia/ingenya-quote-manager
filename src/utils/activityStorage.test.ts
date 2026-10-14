import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Activity } from '../types/activity';
import {
  ACTIVITIES_STORAGE_KEY,
  appendActivityNoteRevision,
  loadActivities,
  recordAutomaticActivity,
  saveActivity,
} from './activityStorage';

const activity: Activity = {
  id: 'activity-1',
  type: 'note',
  occurredAt: '2026-10-14T12:00:00.000Z',
  author: 'Daniel',
  result: 'Registrada',
  note: 'Nota original',
  subject: { kind: 'quote', quoteId: 'quote-1' },
  source: 'manual',
  noteRevisions: [],
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

describe('activity storage', () => {
  it('persists valid activities and keeps valid records when one is corrupt', () => {
    expect(saveActivity(activity)).toBe(true);
    stored.set(ACTIVITIES_STORAGE_KEY, JSON.stringify([{ id: 'broken' }, activity]));
    expect(loadActivities()).toEqual({ items: [activity], issue: 'invalid-entries' });
  });

  it('does not duplicate an activity id or overwrite an invalid root', () => {
    expect(saveActivity(activity)).toBe(true);
    expect(saveActivity(activity)).toBe(false);
    stored.set(ACTIVITIES_STORAGE_KEY, '{broken');
    expect(saveActivity({ ...activity, id: 'second' })).toBe(false);
    expect(stored.get(ACTIVITIES_STORAGE_KEY)).toBe('{broken');
  });

  it('appends a note revision only for the original manual author', () => {
    saveActivity(activity);
    const revision = {
      editedAt: '2026-10-14T13:00:00.000Z',
      editedBy: 'Daniel',
      note: 'Nota corregida',
    };
    expect(appendActivityNoteRevision(activity.id, 'Otra persona', revision)).toBe(false);
    expect(appendActivityNoteRevision(activity.id, 'Daniel', revision)).toBe(true);
    expect(loadActivities().items[0]).toMatchObject({
      note: 'Nota corregida',
      noteRevisions: [revision],
    });
  });

  it('records automatic events independently from the quote document', () => {
    const quoteSnapshot = {
      id: 'quote-1',
      status: 'finalized',
      lines: [{ id: 'line', unitPrice: 100 }],
      clientName: 'Ana',
    };
    expect(
      recordAutomaticActivity(
        { kind: 'quote', quoteId: quoteSnapshot.id },
        'finalized',
        'Presupuesto finalizado.',
      ),
    ).toBe(true);
    expect(loadActivities().items[0]).toMatchObject({
      source: 'automatic',
      event: 'finalized',
      subject: { kind: 'quote', quoteId: quoteSnapshot.id },
    });
    expect(quoteSnapshot).toEqual({
      id: 'quote-1',
      status: 'finalized',
      lines: [{ id: 'line', unitPrice: 100 }],
      clientName: 'Ana',
    });
  });
});
