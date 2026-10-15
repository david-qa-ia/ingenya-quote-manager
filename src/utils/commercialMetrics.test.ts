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
  it('counts objective flow metrics, rates and durations without mutating sources', () => {
    const original = structuredClone(base);
    const metrics = calculateCommercialMetrics(base, filters, new Date('2026-10-13T00:00:00.000Z'));
    expect(metrics.kpis.opportunitiesCreated.value).toBe(1);
    expect(metrics.kpis.quotesSent.value).toBe(1);
    expect(metrics.kpis.quotesAccepted.value).toBe(1);
    expect(metrics.kpis.followUpsCompleted.value).toBe(1);
    expect(metrics.kpis.followUpsRescheduled.value).toBe(1);
    expect(metrics.opportunityConversion.rate).toBe(100);
    expect(metrics.quoteConversion.rate).toBe(100);
    expect(metrics.averageFirstContactHours).toBe(2);
    expect(metrics.averageResultHours).toBe(48);
    expect(base).toEqual(original);
  });
  it('returns null rates for zero denominators and flags corrections and partial coverage', () => {
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
    expect(metrics.quoteConversion.rate).toBeNull();
    expect(metrics.hasAmbiguousCorrections).toBe(true);
    expect(metrics.partialCoverage).toBe(true);
  });
  it('keeps multiple quote rejections and filters services without exposing contact data', () => {
    const second = {
      ...base.quotes[0],
      id: 'quote-2',
      lines: [{ ...base.quotes[0].lines[0], name: 'Revoque' }],
    };
    const metrics = calculateCommercialMetrics(
      {
        ...base,
        quotes: [...base.quotes, second],
        outcomes: [
          ...base.outcomes,
          {
            ...base.outcomes[0],
            id: 'rejected',
            type: 'rejected',
            quoteId: 'quote-2',
            occurredAt: '2026-10-12T13:00:00.000Z',
          },
        ],
      },
      { ...filters, service: 'Revoque' },
    );
    expect(metrics.kpis.quotesRejected.value).toBe(1);
    expect(metrics.kpis.quotesSent.value).toBe(1);
  });
});
