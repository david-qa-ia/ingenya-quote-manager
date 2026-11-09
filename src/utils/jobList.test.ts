import { describe, expect, it } from 'vitest';
import type { Client } from '../types/client';
import type { Opportunity } from '../types/opportunity';
import type { Prospect } from '../types/prospect';
import type { SavedQuote } from '../types/quote';
import { buildJobList, countJobsByStage, filterJobs } from './jobList';

const prospect = (overrides: Partial<Prospect>): Prospect => ({
  id: 'p1',
  name: 'Ana Paz',
  company: '',
  phone: '341 600-0001',
  email: '',
  source: 'Recomendación',
  potentialService: 'Pintura',
  notes: '',
  status: 'uncontacted',
  priority: 'medium',
  priorityReason: '',
  nextAction: '',
  nextActionAt: '',
  responsible: 'Daniel',
  preferredChannel: '',
  activities: [],
  createdAt: '2026-11-01T12:00:00.000Z',
  updatedAt: '2026-11-01T12:00:00.000Z',
  ...overrides,
});

const client: Client = {
  id: 'c1',
  name: 'Marta Gómez',
  company: 'Consorcio Belgrano',
  phone: '341 555-1234',
  email: '',
  preferredChannel: 'whatsapp',
  contactConsent: true,
  createdAt: '2026-11-01T12:00:00.000Z',
  updatedAt: '2026-11-01T12:00:00.000Z',
};

const opportunity = (overrides: Partial<Opportunity>): Opportunity => ({
  id: 'o1',
  clientId: 'c1',
  name: 'Pintura palier',
  address: '',
  estimatedStartDate: '',
  responsibleSeller: 'Daniel',
  qualification: {
    serviceOfInterest: 'Pintura de palier',
    interestLevel: 'high',
    detectedNeed: '',
    estimatedValue: 900000,
  },
  createdAt: '2026-11-02T12:00:00.000Z',
  updatedAt: '2026-11-02T12:00:00.000Z',
  ...overrides,
});

const quote = (overrides: Partial<SavedQuote>): SavedQuote => ({
  id: 'q1',
  status: 'finalized',
  commercialStatus: 'prepared',
  commercialStatusAudit: { changedAt: '', changedBy: '', reason: '' },
  opportunityId: 'o1',
  clientName: 'Marta Gómez',
  projectName: 'Pintura palier',
  lines: [
    {
      id: 'l1',
      name: 'Pintura',
      unit: 'squareMeter',
      quantity: 120,
      unitPrice: 8500,
      source: 'manual',
    },
  ],
  version: 1,
  savedAt: '2026-11-03T12:00:00.000Z',
  ...overrides,
});

const nextAction = (dueAt: string) => ({
  id: 'a1',
  type: 'call' as const,
  description: 'Llamar para coordinar visita',
  dueAt,
  responsible: 'Daniel',
  priority: 'medium' as const,
  status: 'pending' as const,
  createdAt: dueAt,
  updatedAt: dueAt,
  history: [],
});

describe('buildJobList', () => {
  it('shows a converted prospect once, as its opportunity, with the client name', () => {
    const rows = buildJobList({
      prospects: [prospect({ status: 'converted' })],
      opportunities: [opportunity({})],
      clients: [client],
      quotes: [],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: 'opportunity',
      name: 'Marta Gómez',
      company: 'Consorcio Belgrano',
      service: 'Pintura de palier',
      stage: 'quoting',
      amount: 900000,
    });
  });

  it('leaves archived prospects out of the list', () => {
    const rows = buildJobList({
      prospects: [prospect({ archivedAt: '2026-11-05T12:00:00.000Z' })],
      opportunities: [],
      clients: [],
      quotes: [],
    });

    expect(rows).toEqual([]);
  });

  it('maps prospect statuses to the first stages and not interested to lost', () => {
    const rows = buildJobList({
      prospects: [
        prospect({ id: 'new', status: 'contactToday' }),
        prospect({ id: 'contacted', status: 'noResponse' }),
        prospect({ id: 'lost', status: 'notInterested' }),
      ],
      opportunities: [],
      clients: [],
      quotes: [],
    });

    expect(Object.fromEntries(rows.map((row) => [row.id, row.stage]))).toEqual({
      new: 'new',
      contacted: 'contacted',
      lost: 'lost',
    });
  });

  it('takes the stage and amount from the latest quote version', () => {
    const rows = buildJobList({
      prospects: [],
      opportunities: [opportunity({})],
      clients: [client],
      quotes: [
        quote({ id: 'v1', version: 1, commercialStatus: 'sent' }),
        quote({
          id: 'v2',
          version: 2,
          commercialStatus: 'followingUp',
          lines: [
            {
              id: 'l1',
              name: 'Pintura',
              unit: 'squareMeter',
              quantity: 110,
              unitPrice: 8500,
              source: 'manual',
            },
          ],
        }),
      ],
    });

    expect(rows[0]).toMatchObject({ stage: 'sent', amount: 935000 });
  });

  it('marks won and lost opportunities as closed jobs', () => {
    const rows = buildJobList({
      prospects: [],
      opportunities: [
        opportunity({ id: 'won', commercialState: 'won' }),
        opportunity({ id: 'lost', commercialState: 'lost' }),
      ],
      clients: [client],
      quotes: [],
    });

    expect(rows.map((row) => row.stage).sort()).toEqual(['lost', 'won']);
  });

  it('puts open jobs first, the most urgent next step on top', () => {
    const rows = buildJobList({
      prospects: [
        prospect({
          id: 'later',
          nextAction: 'Llamar',
          nextActionAt: '2026-11-12T10:00:00.000Z',
        }),
        prospect({ id: 'none' }),
      ],
      opportunities: [
        opportunity({ id: 'closed', commercialState: 'won' }),
        opportunity({ id: 'soon', nextAction: nextAction('2026-11-10T10:00:00.000Z') }),
      ],
      clients: [client],
      quotes: [],
    });

    expect(rows.map((row) => row.id)).toEqual(['soon', 'later', 'none', 'closed']);
  });
});

describe('filterJobs', () => {
  const rows = buildJobList({
    prospects: [prospect({ id: 'p', name: 'Ana Paz', potentialService: 'Electricidad' })],
    opportunities: [opportunity({ id: 'won', commercialState: 'won' }), opportunity({})],
    clients: [client],
    quotes: [],
  });

  it('keeps only open jobs by default and finds them ignoring accents', () => {
    expect(filterJobs(rows, { stage: 'open', query: '' }).map((row) => row.id)).toEqual(
      expect.arrayContaining(['p', 'o1']),
    );
    expect(filterJobs(rows, { stage: 'open', query: '' })).toHaveLength(2);
    expect(filterJobs(rows, { stage: 'all', query: 'gomez' }).map((row) => row.id)).toEqual(
      expect.arrayContaining(['o1', 'won']),
    );
  });

  it('counts jobs per stage for the filter chips', () => {
    expect(countJobsByStage(rows)).toMatchObject({ open: 2, all: 3, new: 1, won: 1 });
  });
});
