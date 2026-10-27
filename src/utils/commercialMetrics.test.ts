import { describe, expect, it } from 'vitest';
import type { CommercialMetricsSources } from '../types/commercialMetrics';
import { defaultCommercialMetricsFilters } from '../types/commercialMetrics';
import {
  calculateCommercialMetrics,
  getArgentinaToday,
  getPreviousPeriod,
} from './commercialMetrics';

const base: CommercialMetricsSources = {
  clients: [
    {
      id: 'client',
      name: 'Ana',
      phone: '1',
      email: 'a@b.com',
      preferredChannel: '',
      contactConsent: true,
      doNotContact: { reason: 'Pedido', recordedAt: '2026-10-01T00:00:00.000Z', recordedBy: 'Ana' },
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    },
  ],
  opportunities: [
    {
      id: 'opportunity',
      clientId: 'client',
      name: 'Obra',
      address: '',
      estimatedStartDate: '',
      responsibleSeller: 'Daniel',
      commercialState: 'won',
      createdAt: '2026-10-10T12:00:00.000Z',
      updatedAt: '2026-10-10T12:00:00.000Z',
      nextAction: {
        id: 'action',
        type: 'call',
        description: 'Llamar',
        dueAt: '2026-10-12T12:00:00.000Z',
        responsible: 'Daniel',
        priority: 'medium',
        status: 'completed',
        createdAt: '2026-10-10T12:00:00.000Z',
        updatedAt: '2026-10-12T12:00:00.000Z',
        history: [
          {
            id: 'complete',
            occurredAt: '2026-10-12T12:00:00.000Z',
            actor: 'Daniel',
            event: 'completed',
            reason: 'Hecha',
            result: 'Contestó',
          },
          {
            id: 'reschedule',
            occurredAt: '2026-10-11T12:00:00.000Z',
            actor: 'Daniel',
            event: 'rescheduled',
            reason: 'Cambió',
            previousDueAt: '2026-10-11T10:00:00.000Z',
          },
        ],
      },
    },
  ],
  quotes: [
    {
      id: 'quote',
      status: 'finalized',
      commercialStatus: 'accepted',
      commercialStatusAudit: {
        changedAt: '2026-10-12T12:00:00.000Z',
        changedBy: 'Daniel',
        reason: 'ok',
      },
      sentAudit: { changedAt: '2026-10-11T12:00:00.000Z', changedBy: 'Daniel', reason: 'ok' },
      clientId: 'client',
      opportunityId: 'opportunity',
      clientName: 'Ana',
      projectName: 'Obra',
      savedAt: '2026-10-10T12:00:00.000Z',
      lines: [
        { id: 'line', name: 'Pintura', unit: 'unit', quantity: 1, unitPrice: 1, source: 'manual' },
      ],
    },
  ],
  activities: [
    {
      id: 'contact',
      type: 'call',
      occurredAt: '2026-10-10T14:00:00.000Z',
      author: 'Daniel',
      result: 'effectiveContact',
      note: '',
      subject: { kind: 'opportunity', opportunityId: 'opportunity' },
      source: 'manual',
      noteRevisions: [],
    },
  ],
  executions: [],
  outcomes: [
    {
      id: 'accepted',
      type: 'accepted',
      reasonCode: 'price',
      occurredAt: '2026-10-12T12:00:00.000Z',
      author: 'Daniel',
      origin: 'commercialPanel',
      opportunityId: 'opportunity',
      quoteId: 'quote',
    },
  ],
  issues: [],
};
const filters = {
  ...defaultCommercialMetricsFilters,
  startDate: '2026-10-10',
  endDate: '2026-10-12',
};

describe('commercial metrics', () => {
  it('uses Argentina local days and exposes the previous inclusive period', () => {
    expect(getArgentinaToday(new Date('2026-10-15T02:00:00.000Z'))).toBe('2026-10-14');
    expect(getPreviousPeriod(filters)?.start).toContain('2026-10-07');
  });
  it('counts recorded activity without inferring funnel status', () => {
    const original = structuredClone(base);
    const metrics = calculateCommercialMetrics(base, filters);
    expect(metrics.kpis.activitiesRegistered.value).toBe(1);
    expect(metrics.kpis.contactsRegistered.value).toBe(1);
    expect(metrics.kpis.effectiveContacts.value).toBe(1);
    expect(metrics.kpis.notesAdded.value).toBe(0);
    expect(metrics.kpis.quotesSent.value).toBe(1);
    expect(metrics.kpis.followUpsCompleted.value).toBe(1);
    expect(metrics.kpis.followUpsRescheduled.value).toBe(1);
    expect(metrics.contactEffectiveness).toEqual({ effective: 1, registered: 1 });
    expect(metrics.focus).toBe('keepMomentum');
    expect(metrics.trend).toHaveLength(2);
    expect(base).toEqual(original);
  });
  it('flags partial coverage without substituting activity data', () => {
    const metrics = calculateCommercialMetrics(
      {
        ...base,
        opportunities: base.opportunities,
        quotes: [],
        outcomes: [{ ...base.outcomes[0], type: 'corrected', supersedesOutcomeId: 'accepted' }],
        issues: ['invalid-entries'],
      },
      filters,
    );
    expect(metrics.partialCoverage).toBe(true);
  });
  it('filters recorded activity by author and selected quote', () => {
    const second = {
      ...base.quotes[0],
      id: 'quote-2',
    };
    const metrics = calculateCommercialMetrics(
      {
        ...base,
        quotes: [...base.quotes, second],
        activities: [
          ...base.activities,
          {
            ...base.activities[0],
            id: 'note-by-ana',
            type: 'note',
            author: 'Ana',
            occurredAt: '2026-10-12T13:00:00.000Z',
            subject: { kind: 'quote', quoteId: 'quote-2' },
          },
        ],
      },
      { ...filters, quoteId: 'quote-2', responsible: 'Ana' },
    );
    expect(metrics.kpis.activitiesRegistered.value).toBe(1);
    expect(metrics.kpis.notesAdded.value).toBe(1);
    expect(metrics.kpis.contactsRegistered.value).toBe(0);
    expect(metrics.focus).toBe('registerContact');
  });
  it('suggests following up when contacts have no effective result', () => {
    const metrics = calculateCommercialMetrics(
      {
        ...base,
        activities: [{ ...base.activities[0], result: 'noResponse' }],
      },
      filters,
    );
    expect(metrics.focus).toBe('followUpContacts');
  });
});
