export type WorkUnit = 'squareMeter' | 'linearMeter' | 'unit';

export type QuoteLineSource = 'catalog' | 'manual';

export interface CatalogJob {
  id: string;
  name: string;
  unit: WorkUnit;
  defaultPrice: number;
  description?: string;
  isActive: boolean;
}

export interface QuoteLine {
  id: string;
  catalogJobId?: string;
  name: string;
  unit: WorkUnit;
  quantity: number;
  unitPrice: number;
  source: QuoteLineSource;
}
