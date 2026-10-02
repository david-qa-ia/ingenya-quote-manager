import type { CatalogJob, QuoteLine, WorkUnit } from '../types/quote';
import { addCatalogJob } from './jobCatalogStorage';
import { validateCatalogJobInput } from './jobCatalogValidation';
import { createCatalogQuoteLine, createManualQuoteLine } from './quoteLineFactory';

interface QuickServiceInput {
  name: string;
  description?: string;
  unit: WorkUnit;
  quantity: number;
  unitPrice: number;
}

type QuickServiceAdditionResult =
  | { success: true; line: QuoteLine; catalogJobs: CatalogJob[] | null }
  | { success: false; message: string };

export function addQuickService(
  jobs: readonly CatalogJob[],
  input: QuickServiceInput,
  saveToCatalog: boolean,
  persistCatalog: (jobs: readonly CatalogJob[]) => boolean,
  createId: () => string,
): QuickServiceAdditionResult {
  if (!saveToCatalog) {
    return {
      success: true,
      line: createManualQuoteLine({ ...input, id: createId() }),
      catalogJobs: null,
    };
  }

  const validation = validateCatalogJobInput({
    name: input.name,
    description: input.description,
    unit: input.unit,
    defaultPrice: input.unitPrice,
  });
  if (!validation.success) return validation;

  const catalogJob: CatalogJob = { id: createId(), ...validation.value, isActive: true };
  const nextCatalog = addCatalogJob(jobs, catalogJob);
  if (!persistCatalog(nextCatalog)) {
    return {
      success: false,
      message: 'No se pudo guardar el servicio en el catálogo. No se agregó al presupuesto.',
    };
  }

  return {
    success: true,
    line: createCatalogQuoteLine(catalogJob, createId(), input.quantity, input.unitPrice),
    catalogJobs: nextCatalog,
  };
}
