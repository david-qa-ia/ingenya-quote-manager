import { describe, expect, it } from 'vitest';
import type { Opportunity } from '../types/opportunity';
import {
  calculateFollowUpPriority,
  deriveFollowUpInbox,
  filterFollowUpInbox,
  defaultFollowUpFilters,
} from './followUpInbox';

const action = {
  id: 'action',
  type: 'call' as const,
  description: 'Llamar',
  dueAt: '2026-10-15T14:00:00.000Z',
  responsible: 'Daniel',
  priority: 'high' as const,
  status: 'pending' as const,
  createdAt: '2026-10-14T00:00:00.000Z',
  updatedAt: '2026-10-14T00:00:00.000Z',
  history: [],
};
const opportunity: Opportunity = {
  id: 'opportunity',
  clientId: 'client',
  name: 'Obra Norte',
  address: '',
  estimatedStartDate: '',
  responsibleSeller: 'Daniel',
  status: 'active',
  nextAction: action,
  createdAt: action.createdAt,
  updatedAt: action.updatedAt,
};
const client = {
  id: 'client',
  name: 'Ana',
  phone: '3415550101',
  email: 'ana@example.com',
  preferredChannel: '' as const,
  contactConsent: true,
  createdAt: action.createdAt,
  updatedAt: action.updatedAt,
};

describe('follow-up inbox', () => {
  it('keeps future actions after seven days and does not mutate sources', () => {
    const original = structuredClone(opportunity);
    const items = deriveFollowUpInbox(
      [{ ...opportunity, nextAction: { ...action, dueAt: '2026-11-01T14:00:00.000Z' } }],
      [client],
      [],
      [],
      [],
      new Date('2026-10-14T12:00:00.000Z'),
    );
    expect(items[0].bucket).toBe('upcoming');
    expect(opportunity).toEqual(original);
  });
  it('uses Buenos Aires day boundaries and excludes closed opportunities', () => {
    expect(
      deriveFollowUpInbox(
        [opportunity],
        [client],
        [],
        [],
        [],
        new Date('2026-10-15T12:00:00.000Z'),
      )[0].bucket,
    ).toBe('today');
    expect(
      deriveFollowUpInbox([{ ...opportunity, status: 'closed' }], [client], [], [], [], new Date()),
    ).toEqual([]);
  });
  it('explains priority and supports combined filters and stable sorting', () => {
    const priority = calculateFollowUpPriority(
      {
        bucket: 'overdue',
        manualPriority: 'high',
        source: 'opportunityCadence',
        rescheduleCount: 2,
      },
      null,
    );
    expect(priority.reasons).toEqual(
      expect.arrayContaining([
        'Acción vencida',
        'Prioridad manual alta',
        'Cadencia activa',
        'Reprogramada 2 veces',
      ]),
    );
    const items = deriveFollowUpInbox(
      [opportunity],
      [client],
      [],
      [],
      [],
      new Date('2026-10-14T12:00:00.000Z'),
    );
    expect(
      filterFollowUpInbox(items, {
        ...defaultFollowUpFilters,
        responsible: 'Daniel',
        channel: 'call',
        search: 'ana',
      }).map((item) => item.id),
    ).toEqual(['action']);
  });
  it('marks do-not-contact without exposing destinations', () => {
    const items = deriveFollowUpInbox(
      [opportunity],
      [
        {
          ...client,
          doNotContact: { reason: 'Pedido', recordedAt: action.createdAt, recordedBy: 'Ana' },
        },
      ],
      [],
      [],
      [],
      new Date('2026-10-14T12:00:00.000Z'),
    );
    expect(items[0]).toMatchObject({ contactRestricted: true, phone: '3415550101' });
  });
});
