import { describe, expect, it } from 'vitest';
import {
  countActiveProspectFilters,
  defaultProspectFilters,
  normalizeProspectFilters,
} from './prospectWorkflow';

describe('normalizeProspectFilters (SCRUM-110)', () => {
  it('falls back to "all" for an empty or unknown value', () => {
    expect(
      normalizeProspectFilters({ status: 'all', priority: 'all', channel: 'all', service: '' }),
    ).toEqual(defaultProspectFilters);
    expect(
      normalizeProspectFilters({ status: 'archivado', priority: 'urgent', channel: 'fax' }),
    ).toEqual(defaultProspectFilters);
  });

  it('keeps valid values', () => {
    expect(
      normalizeProspectFilters(
        { status: 'contacted', priority: 'high', channel: 'whatsapp', service: 'Pintura' },
        { services: ['Pintura', 'Revoque'] },
      ),
    ).toEqual({ status: 'contacted', priority: 'high', channel: 'whatsapp', service: 'Pintura' });
  });

  it('drops a service that no prospect has anymore', () => {
    expect(
      normalizeProspectFilters({ service: 'Impermeabilización' }, { services: ['Pintura'] })
        .service,
    ).toBe('all');
  });

  it('tolerates corrupted stored data', () => {
    expect(normalizeProspectFilters(null)).toEqual(defaultProspectFilters);
    expect(normalizeProspectFilters(['contacted'])).toEqual(defaultProspectFilters);
    expect(normalizeProspectFilters({ status: 3 })).toEqual(defaultProspectFilters);
  });

  it('counts the filters that are actually applied', () => {
    expect(countActiveProspectFilters(defaultProspectFilters)).toBe(0);
    expect(
      countActiveProspectFilters({ ...defaultProspectFilters, status: 'contacted', service: 'X' }),
    ).toBe(2);
  });
});
