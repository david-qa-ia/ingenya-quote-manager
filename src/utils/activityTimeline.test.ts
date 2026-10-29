import { describe, expect, it } from 'vitest';
import type { Activity } from '../types/activity';
import {
  formatActivityDateTime,
  getActivityResultLabel,
  getTimelineActivities,
  getTimelineActivitiesForSubjects,
} from './activityTimeline';

const activities: Activity[] = [
  {
    id: 'a',
    type: 'call',
    occurredAt: '2026-10-14T10:00:00.000Z',
    author: 'Daniel',
    result: 'noAnswer',
    note: '',
    subject: { kind: 'quote', quoteId: 'quote' },
    source: 'manual',
    noteRevisions: [],
  },
  {
    id: 'b',
    type: 'note',
    occurredAt: '2026-10-14T12:00:00.000Z',
    author: 'Daniel',
    result: 'Registrada',
    note: '',
    subject: { kind: 'quote', quoteId: 'quote' },
    source: 'manual',
    noteRevisions: [],
  },
  {
    id: 'c',
    type: 'email',
    occurredAt: '2026-10-14T13:00:00.000Z',
    author: 'Daniel',
    result: 'Enviado',
    note: '',
    subject: { kind: 'client', clientId: 'client' },
    source: 'manual',
    noteRevisions: [],
  },
];

describe('activity timeline', () => {
  it('orders matching activities chronologically without mutating the source', () => {
    const original = structuredClone(activities);
    expect(
      getTimelineActivities(activities, { kind: 'quote', quoteId: 'quote' }, 'all').map(
        (item) => item.id,
      ),
    ).toEqual(['b', 'a']);
    expect(activities).toEqual(original);
  });

  it('filters activities by type inside the selected context', () => {
    expect(
      getTimelineActivities(activities, { kind: 'quote', quoteId: 'quote' }, 'call').map(
        (item) => item.id,
      ),
    ).toEqual(['a']);
  });

  it('combines quote, client and opportunity activities in one chronological timeline', () => {
    expect(
      getTimelineActivitiesForSubjects(
        activities,
        [
          { kind: 'quote', quoteId: 'quote' },
          { kind: 'client', clientId: 'client' },
          { kind: 'opportunity', opportunityId: 'opportunity' },
        ],
        'all',
      ).map((item) => item.id),
    ).toEqual(['c', 'b', 'a']);
  });
});

describe('activity display helpers', () => {
  it('translates call result codes instead of showing them raw (SCRUM-102)', () => {
    expect(getActivityResultLabel({ ...activities[0], result: 'effectiveContact' })).toBe(
      'Contacto efectivo',
    );
    expect(
      getActivityResultLabel({ ...activities[0], type: 'whatsapp', result: 'Contacto registrado' }),
    ).toBe('Contacto registrado');
  });

  it('formats history times in 24-hour Argentina time', () => {
    expect(formatActivityDateTime('2026-10-29T00:17:14.000Z')).toBe('28/10/2026, 21:17');
  });
});
