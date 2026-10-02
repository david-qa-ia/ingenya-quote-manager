import { describe, expect, it } from 'vitest';
import type { CatalogJob } from '../types/quote';
import { filterCatalogJobs } from './jobCatalogFilters';

const jobs: CatalogJob[] = [
  {
    id: 'paint',
    name: 'Pintar pared',
    description: 'Interior',
    unit: 'squareMeter',
    defaultPrice: 10,
    isActive: true,
  },
  {
    id: 'door',
    name: 'Instalar puerta',
    description: 'Exterior',
    unit: 'unit',
    defaultPrice: 20,
    isActive: false,
  },
];

describe('filterCatalogJobs', () => {
  it('searches by name or description without case sensitivity', () => {
    expect(filterCatalogJobs(jobs, ' PINTAR ', 'all').map((job) => job.id)).toEqual(['paint']);
    expect(filterCatalogJobs(jobs, 'exterior', 'all').map((job) => job.id)).toEqual(['door']);
  });

  it('combines search with active and inactive filters', () => {
    expect(filterCatalogJobs(jobs, '', 'active').map((job) => job.id)).toEqual(['paint']);
    expect(filterCatalogJobs(jobs, 'interior', 'inactive')).toEqual([]);
    expect(filterCatalogJobs(jobs, '', 'inactive').map((job) => job.id)).toEqual(['door']);
  });

  it('does not mutate the collection', () => {
    const original = structuredClone(jobs);
    filterCatalogJobs(jobs, '', 'all');
    expect(jobs).toEqual(original);
  });
});
