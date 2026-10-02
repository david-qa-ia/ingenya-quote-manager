export type WorkUnit = 'squareMeter' | 'linearMeter' | 'unit';

export type QuoteLineSource = 'catalog' | 'manual';

export type QuoteStatus = 'draft' | 'finalized';

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
  description?: string;
  unit: WorkUnit;
  quantity: number;
  unitPrice: number;
  source: QuoteLineSource;
}

export interface Quote {
  id: string;
  status: QuoteStatus;
  clientName: string;
  projectName: string;
  lines: QuoteLine[];
}

export interface QuoteDraft extends Quote {
  status: 'draft';
}

export interface SavedQuote extends Quote {
  savedAt: string;
}
