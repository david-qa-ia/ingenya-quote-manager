import { describe, expect, it } from 'vitest';
import { isCatalogJob, validateCatalogJobInput } from './jobCatalogValidation';

describe('validateCatalogJobInput', () => {
  it('normalizes valid catalog data', () => {
    expect(
      validateCatalogJobInput({
        name: '  Pintar cielorraso  ',
        description: '  Preparación y dos manos  ',
        unit: 'squareMeter',
        defaultPrice: 25000,
      }),
    ).toEqual({
      success: true,
      value: {
        name: 'Pintar cielorraso',
        description: 'Preparación y dos manos',
        unit: 'squareMeter',
        defaultPrice: 25000,
      },
    });
  });

  it.each([
    [{ name: '', unit: 'unit', defaultPrice: 1 }, 'nombre'],
    [{ name: 'Servicio', unit: 'invalid', defaultPrice: 1 }, 'unidad'],
    [{ name: 'Servicio', unit: 'unit', defaultPrice: 0 }, 'mayor que cero'],
    [{ name: 'Servicio', unit: 'unit', defaultPrice: -1 }, 'mayor que cero'],
    [{ name: 'Servicio', unit: 'unit', defaultPrice: Number.NaN }, 'mayor que cero'],
  ])('rejects invalid catalog data', (input, message) => {
    const result = validateCatalogJobInput(input as Parameters<typeof validateCatalogJobInput>[0]);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.message).toContain(message);
  });
});

describe('isCatalogJob', () => {
  it('accepts an optional description and rejects a non-positive suggested price', () => {
    const job = { id: 'job-1', name: 'Servicio', unit: 'unit', defaultPrice: 10, isActive: true };
    expect(isCatalogJob(job)).toBe(true);
    expect(isCatalogJob({ ...job, description: 'Detalle' })).toBe(true);
    expect(isCatalogJob({ ...job, defaultPrice: 0 })).toBe(false);
  });
});
