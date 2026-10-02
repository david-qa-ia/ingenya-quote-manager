import { describe, expect, it } from 'vitest';
import type { CatalogJob } from '../types/quote';
import { createCatalogQuoteLine, createManualQuoteLine } from './quoteLineFactory';

const job: CatalogJob = {
  id: 'paint',
  name: 'Pintar pared',
  description: 'Dos manos',
  unit: 'squareMeter',
  defaultPrice: 100,
  isActive: true,
};

describe('quote line factories', () => {
  it('creates an independent snapshot from a catalog service', () => {
    const line = createCatalogQuoteLine(job, 'line-1', 2, 80);
    job.name = 'Nombre cambiado';
    job.description = 'Descripción cambiada';
    job.defaultPrice = 200;
    job.isActive = false;

    expect(line).toEqual({
      id: 'line-1',
      catalogJobId: 'paint',
      name: 'Pintar pared',
      description: 'Dos manos',
      unit: 'squareMeter',
      quantity: 2,
      unitPrice: 80,
      source: 'catalog',
    });
  });

  it('creates a quick manual line without a catalog reference', () => {
    expect(
      createManualQuoteLine({
        id: 'line-2',
        name: 'Reparar',
        unit: 'unit',
        quantity: 1,
        unitPrice: 0,
      }),
    ).toEqual({
      id: 'line-2',
      name: 'Reparar',
      unit: 'unit',
      quantity: 1,
      unitPrice: 0,
      source: 'manual',
    });
  });
});
