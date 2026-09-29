import type { QuoteDraft, QuoteLine, QuoteLineSource, WorkUnit } from '../types/quote';

export const QUOTE_DRAFT_STORAGE_KEY = 'ingenya.quoteDraft.v1';

const validWorkUnits: WorkUnit[] = ['squareMeter', 'linearMeter', 'unit'];
const validLineSources: QuoteLineSource[] = ['catalog', 'manual'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isWorkUnit(value: unknown): value is WorkUnit {
  return typeof value === 'string' && validWorkUnits.includes(value as WorkUnit);
}

function isLineSource(value: unknown): value is QuoteLineSource {
  return typeof value === 'string' && validLineSources.includes(value as QuoteLineSource);
}

function isQuoteLine(value: unknown): value is QuoteLine {
  if (!isRecord(value)) return false;

  const hasValidCatalogJobId =
    value.catalogJobId === undefined || isNonEmptyString(value.catalogJobId);

  return (
    isNonEmptyString(value.id) &&
    hasValidCatalogJobId &&
    isNonEmptyString(value.name) &&
    isWorkUnit(value.unit) &&
    isPositiveFiniteNumber(value.quantity) &&
    isPositiveFiniteNumber(value.unitPrice) &&
    isLineSource(value.source)
  );
}

function isQuoteDraft(value: unknown): value is QuoteDraft {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    value.status === 'draft' &&
    typeof value.clientName === 'string' &&
    typeof value.projectName === 'string' &&
    Array.isArray(value.lines) &&
    value.lines.every(isQuoteLine)
  );
}

export function parseQuoteDraft(storedValue: string | null): QuoteDraft | null {
  if (storedValue === null) return null;

  try {
    const parsedValue: unknown = JSON.parse(storedValue);
    return isQuoteDraft(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
}

export function loadQuoteDraft(): QuoteDraft | null {
  try {
    return parseQuoteDraft(localStorage.getItem(QUOTE_DRAFT_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveQuoteDraft(draft: QuoteDraft): boolean {
  try {
    localStorage.setItem(QUOTE_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}
