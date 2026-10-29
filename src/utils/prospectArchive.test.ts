import { describe, expect, it } from 'vitest';
import type { Prospect } from '../types/prospect';
import { calculateCommercialMetrics } from './commercialMetrics';
import { deriveFollowUpInbox } from './followUpInbox';
import { isProspect } from './prospectStorage';
import { defaultCommercialMetricsFilters } from '../types/commercialMetrics';
import {
  defaultProspectFilters,
  filterProspects,
  getBulkArchiveCandidates,
  getProspectActivityDisplay,
  withProspectArchived,
} from './prospectWorkflow';

const base: Prospect = {
  id: 'p-active',
  name: 'QA-P06 Activo',
  company: '',
  phone: '3415550106',
  email: '',
  source: 'Referido',
  potentialService: '',
  notes: '',
  status: 'contacted',
  priority: 'medium',
  priorityReason: '',
  nextAction: 'Retomar contacto',
  nextActionAt: '2026-10-30T13:00:00.000Z',
  responsible: 'QA Tester',
  preferredChannel: 'phone',
  activities: [],
  createdAt: '2026-10-28T12:00:00.000Z',
  updatedAt: '2026-10-28T12:00:00.000Z',
};

describe('prospect archive (SCRUM-111)', () => {
  it('archives with a history entry and restores keeping the next step', () => {
    const archived = withProspectArchived(base, {
      archived: true,
      reason: 'Duplicado',
      author: 'QA',
      at: '2026-10-29T12:00:00.000Z',
    });
    expect(archived.archivedAt).toBe('2026-10-29T12:00:00.000Z');
    expect(isProspect(archived)).toBe(true);
    const entry = archived.activities.at(-1)!;
    expect(entry.description).toBe('Archivado: Duplicado.');
    expect(getProspectActivityDisplay(entry).kindLabel).toBe('Archivado');

    const restored = withProspectArchived(archived, { archived: false, author: 'QA' });
    expect(restored.archivedAt).toBeUndefined();
    expect(restored.nextActionAt).toBe(base.nextActionAt);
    expect(restored.activities).toHaveLength(2);
    expect(getProspectActivityDisplay(restored.activities.at(-1)!).kindLabel).toBe('Restaurado');
  });

  it('lists active and archived prospects separately', () => {
    const archived = { ...base, id: 'p-archived', archivedAt: '2026-10-29T12:00:00.000Z' };
    expect(filterProspects([base, archived], defaultProspectFilters).map((p) => p.id)).toEqual([
      'p-active',
    ]);
    expect(
      filterProspects([base, archived], defaultProspectFilters, 'archived').map((p) => p.id),
    ).toEqual(['p-archived']);
  });

  it('bulk cleanup only picks active converted or not-interested prospects', () => {
    const notInterested = { ...base, id: 'p-ni', status: 'notInterested' as const };
    const alreadyArchived = { ...notInterested, id: 'p-ni-2', archivedAt: '2026-10-29T12:00:00Z' };
    expect(
      getBulkArchiveCandidates([base, notInterested, alreadyArchived]).map((p) => p.id),
    ).toEqual(['p-ni']);
  });

  it('removes archived prospects from Seguimiento', () => {
    const archived = { ...base, archivedAt: '2026-10-29T12:00:00.000Z' };
    const now = new Date('2026-10-29T15:00:00.000Z');
    expect(deriveFollowUpInbox([], [], [], [], [], now, [base])).toHaveLength(1);
    expect(deriveFollowUpInbox([], [], [], [], [], now, [archived])).toHaveLength(0);
  });

  it('does not count archive entries as notes in Indicadores', () => {
    const archived = withProspectArchived(base, {
      archived: true,
      reason: 'Duplicado',
      at: '2026-10-29T12:00:00.000Z',
    });
    const metrics = calculateCommercialMetrics(
      {
        opportunities: [],
        clients: [],
        quotes: [],
        activities: [],
        executions: [],
        outcomes: [],
        prospects: [archived],
        issues: [],
      },
      { ...defaultCommercialMetricsFilters, startDate: '2026-10-29', endDate: '2026-10-29' },
    );
    expect(metrics.kpis.notesAdded.value).toBe(0);
  });
});
