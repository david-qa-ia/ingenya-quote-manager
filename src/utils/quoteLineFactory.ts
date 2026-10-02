import type { CatalogJob, QuoteLine, WorkUnit } from '../types/quote';

interface ManualQuoteLineInput {
  id: string;
  name: string;
  description?: string;
  unit: WorkUnit;
  quantity: number;
  unitPrice: number;
}

export function createCatalogQuoteLine(
  job: Readonly<CatalogJob>,
  id: string,
  quantity: number,
  unitPrice: number,
): QuoteLine {
  return {
    id,
    catalogJobId: job.id,
    name: job.name,
    ...(job.description ? { description: job.description } : {}),
    unit: job.unit,
    quantity,
    unitPrice,
    source: 'catalog',
  };
}

export function createManualQuoteLine(input: ManualQuoteLineInput): QuoteLine {
  return {
    id: input.id,
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    unit: input.unit,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    source: 'manual',
  };
}
