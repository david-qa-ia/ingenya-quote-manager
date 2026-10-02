import type { CatalogJob, WorkUnit } from '../types/quote';

export interface CatalogJobInput {
  name: string;
  description?: string;
  unit: WorkUnit;
  defaultPrice: number;
}

export type CatalogJobValidationResult =
  { success: true; value: CatalogJobInput } | { success: false; message: string };

const validWorkUnits = new Set<WorkUnit>(['squareMeter', 'linearMeter', 'unit']);

export function validateCatalogJobInput(input: CatalogJobInput): CatalogJobValidationResult {
  const name = input.name.trim();
  const description = input.description?.trim();

  if (!name) return { success: false, message: 'Ingresá el nombre del servicio.' };
  if (!validWorkUnits.has(input.unit)) {
    return { success: false, message: 'Seleccioná una unidad válida.' };
  }
  if (!Number.isFinite(input.defaultPrice) || input.defaultPrice <= 0) {
    return {
      success: false,
      message: 'Ingresá un precio sugerido válido y mayor que cero.',
    };
  }

  return {
    success: true,
    value: {
      name,
      ...(description ? { description } : {}),
      unit: input.unit,
      defaultPrice: input.defaultPrice,
    },
  };
}

export function isCatalogJob(value: unknown): value is CatalogJob {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const job = value as Record<string, unknown>;
  return (
    typeof job.id === 'string' &&
    job.id.trim().length > 0 &&
    typeof job.name === 'string' &&
    job.name.trim().length > 0 &&
    (job.description === undefined || typeof job.description === 'string') &&
    typeof job.unit === 'string' &&
    validWorkUnits.has(job.unit as WorkUnit) &&
    typeof job.defaultPrice === 'number' &&
    Number.isFinite(job.defaultPrice) &&
    job.defaultPrice > 0 &&
    typeof job.isActive === 'boolean'
  );
}
