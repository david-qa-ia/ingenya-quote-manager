import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialJobCatalog } from '../data/jobCatalog';
import type { CatalogJob } from '../types/quote';
import {
  addCatalogJob,
  LABOR_CATALOG_STORAGE_KEY,
  loadLaborCatalog,
  saveLaborCatalog,
  setCatalogJobActive,
  updateCatalogJob,
} from './jobCatalogStorage';

const customJob: CatalogJob = {
  id: 'custom-job',
  name: 'Reparar techo',
  description: 'Sellado de filtraciones',
  unit: 'squareMeter',
  defaultPrice: 45000,
  isActive: true,
};

describe('labor catalog storage', () => {
  const storedValues = new Map<string, string>();

  beforeEach(() => {
    storedValues.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storedValues.get(key) ?? null,
      setItem: (key: string, value: string) => storedValues.set(key, value),
    });
  });

  it('persists an independent copy of the static seed when the key does not exist', () => {
    const result = loadLaborCatalog();
    expect(result).toEqual({ jobs: initialJobCatalog, issue: null });
    expect(JSON.parse(storedValues.get(LABOR_CATALOG_STORAGE_KEY) ?? '[]')).toEqual(
      initialJobCatalog,
    );
    expect(result.jobs).not.toBe(initialJobCatalog);
  });

  it('preserves invalid root data and returns a safe in-memory recovery with an issue', () => {
    const corruptValue = '{not-json';
    storedValues.set(LABOR_CATALOG_STORAGE_KEY, corruptValue);

    expect(loadLaborCatalog()).toEqual({ jobs: initialJobCatalog, issue: 'invalid-root' });
    expect(storedValues.get(LABOR_CATALOG_STORAGE_KEY)).toBe(corruptValue);
  });

  it('keeps valid entries without reintroducing discarded invalid entries', () => {
    storedValues.set(
      LABOR_CATALOG_STORAGE_KEY,
      JSON.stringify([customJob, { ...customJob, id: 'invalid', defaultPrice: 0 }]),
    );

    expect(loadLaborCatalog()).toEqual({ jobs: [customJob], issue: 'invalid-entries' });
  });

  it('reports initialization failure while still returning the safe seed', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
    });
    expect(loadLaborCatalog()).toEqual({
      jobs: initialJobCatalog,
      issue: 'initialization-write-failed',
    });
  });

  it('saves a catalog and reports storage failures', () => {
    expect(saveLaborCatalog([customJob])).toBe(true);
    expect(loadLaborCatalog()).toEqual({ jobs: [customJob], issue: null });

    vi.stubGlobal('localStorage', {
      setItem: () => {
        throw new Error('quota');
      },
    });
    expect(saveLaborCatalog([customJob])).toBe(false);
  });
});

describe('catalog collection operations', () => {
  it('creates, edits, deactivates and reactivates without mutating previous collections', () => {
    const original = [customJob];
    const added = addCatalogJob(original, { ...customJob, id: 'second' });
    const edited = updateCatalogJob(added, { ...customJob, name: 'Nombre actualizado' });
    const inactive = setCatalogJobActive(edited, customJob.id, false);
    const active = setCatalogJobActive(inactive, customJob.id, true);

    expect(original).toEqual([customJob]);
    expect(added).toHaveLength(2);
    expect(edited[0].name).toBe('Nombre actualizado');
    expect(inactive[0].isActive).toBe(false);
    expect(active[0].isActive).toBe(true);
  });
});
