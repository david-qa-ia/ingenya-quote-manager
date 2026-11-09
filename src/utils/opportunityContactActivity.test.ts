import { describe, expect, it } from 'vitest';
import type { CommercialMetricsSources } from '../types/commercialMetrics';
import { defaultCommercialMetricsFilters } from '../types/commercialMetrics';
import { isActivity } from './activityStorage';
import { calculateCommercialMetrics } from './commercialMetrics';
import { buildOpportunityContactActivity } from './opportunityContactActivity';

const input = {
  id: 'result-1',
  occurredAt: '2026-11-09T13:00:00.000Z',
  author: 'Daniel',
  opportunityId: 'opportunity',
  note: 'Lo ve con el consejo',
};

function metricsFor(sources: Pick<CommercialMetricsSources, 'activities'>) {
  return calculateCommercialMetrics(
    {
      clients: [],
      opportunities: [
        {
          id: 'opportunity',
          clientId: 'client',
          name: 'Obra',
          address: '',
          estimatedStartDate: '',
          responsibleSeller: 'Daniel',
          commercialState: 'open',
          createdAt: '2026-11-01T12:00:00.000Z',
          updatedAt: '2026-11-01T12:00:00.000Z',
        },
      ],
      quotes: [],
      executions: [],
      outcomes: [],
      issues: [],
      ...sources,
    },
    { ...defaultCommercialMetricsFilters, startDate: '2026-11-09', endDate: '2026-11-09' },
  );
}

describe('buildOpportunityContactActivity', () => {
  it('records a call result as an effective contact that keeps the note', () => {
    const activity = buildOpportunityContactActivity({
      ...input,
      channel: 'call',
      result: 'effectiveContact',
    });

    expect(activity).toMatchObject({ type: 'call', note: 'Lo ve con el consejo' });
    expect(isActivity(activity)).toBe(true);
    const metrics = metricsFor({ activities: activity ? [activity] : [] });
    expect(metrics.kpis.contactsRegistered.value).toBe(1);
    expect(metrics.kpis.effectiveContacts.value).toBe(1);
    expect(metrics.kpis.notesAdded.value).toBe(0);
  });

  it('counts an unanswered WhatsApp as a contact that was not effective', () => {
    const activity = buildOpportunityContactActivity({
      ...input,
      channel: 'whatsapp',
      result: 'noAnswer',
    });

    expect(isActivity(activity)).toBe(true);
    const metrics = metricsFor({ activities: activity ? [activity] : [] });
    expect(metrics.kpis.contactsRegistered.value).toBe(1);
    expect(metrics.kpis.effectiveContacts.value).toBe(0);
  });

  it('counts meetings and Instagram as contacts, like calls, WhatsApp and email', () => {
    const meeting = buildOpportunityContactActivity({
      ...input,
      channel: 'meeting',
      result: 'effectiveContact',
    });
    const instagram = buildOpportunityContactActivity({
      ...input,
      id: 'result-2',
      channel: 'instagram',
      result: 'noAnswer',
    });

    expect(meeting).toMatchObject({ type: 'meeting', note: 'Lo ve con el consejo' });
    expect(instagram).toMatchObject({ type: 'instagram', result: 'noAnswer' });
    expect([meeting, instagram].every(isActivity)).toBe(true);
    const metrics = metricsFor({ activities: [meeting!, instagram!] });
    expect(metrics.kpis.contactsRegistered.value).toBe(2);
    expect(metrics.kpis.effectiveContacts.value).toBe(1);
    expect(metrics.kpis.notesAdded.value).toBe(0);
  });

  it('counts meetings and Instagram saved as notes before they had a type', () => {
    const legacy = (id: string, result: string) => ({
      id,
      type: 'note' as const,
      occurredAt: input.occurredAt,
      author: 'Daniel',
      result,
      note: `${result} Lo ve con el consejo`,
      subject: { kind: 'opportunity' as const, opportunityId: 'opportunity' },
      source: 'manual' as const,
      noteRevisions: [],
    });
    const metrics = metricsFor({
      activities: [
        legacy('old-meeting', 'Reunión: Interesado.'),
        legacy('old-instagram', 'Instagram: No respondió.'),
        legacy('plain-note', 'Nota registrada'),
      ],
    });

    expect(metrics.kpis.contactsRegistered.value).toBe(2);
    expect(metrics.kpis.effectiveContacts.value).toBe(1);
    expect(metrics.kpis.notesAdded.value).toBe(1);
  });

  it('keeps only the note when there is no channel or no known outcome', () => {
    expect(buildOpportunityContactActivity({ ...input, result: 'effectiveContact' })).toMatchObject(
      { type: 'note', note: 'Lo ve con el consejo' },
    );
    expect(
      buildOpportunityContactActivity({ ...input, note: ' ', channel: 'call', result: 'Hecha' }),
    ).toBeNull();
  });
});
