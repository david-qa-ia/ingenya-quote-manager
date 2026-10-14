import { hasRecordId, readCollection } from './localCollectionStorage';
import type {
  Quote,
  QuoteLine,
  QuoteLineSource,
  QuoteStatus,
  SavedQuote,
  WorkUnit,
} from '../types/quote';

export const SAVED_QUOTES_STORAGE_KEY = 'ingenya.savedQuotes.v1';

const validWorkUnits: WorkUnit[] = ['squareMeter', 'linearMeter', 'unit'];
const validLineSources: QuoteLineSource[] = ['catalog', 'manual'];
const validQuoteStatuses: QuoteStatus[] = ['draft', 'finalized'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isWorkUnit(value: unknown): value is WorkUnit {
  return typeof value === 'string' && validWorkUnits.includes(value as WorkUnit);
}

function isLineSource(value: unknown): value is QuoteLineSource {
  return typeof value === 'string' && validLineSources.includes(value as QuoteLineSource);
}

function isQuoteStatus(value: unknown): value is QuoteStatus {
  return typeof value === 'string' && validQuoteStatuses.includes(value as QuoteStatus);
}

function isQuoteLine(value: unknown): value is QuoteLine {
  if (!isRecord(value)) return false;

  const hasValidCatalogJobId =
    value.catalogJobId === undefined || isNonEmptyString(value.catalogJobId);

  return (
    isNonEmptyString(value.id) &&
    hasValidCatalogJobId &&
    isNonEmptyString(value.name) &&
    (value.description === undefined || typeof value.description === 'string') &&
    isWorkUnit(value.unit) &&
    isPositiveFiniteNumber(value.quantity) &&
    isNonNegativeFiniteNumber(value.unitPrice) &&
    isLineSource(value.source)
  );
}

function isQuote(value: unknown): value is Quote {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isQuoteStatus(value.status) &&
    typeof value.clientName === 'string' &&
    typeof value.projectName === 'string' &&
    Array.isArray(value.lines) &&
    value.lines.every(isQuoteLine) &&
    (value.status === 'draft' || value.lines.length > 0)
  );
}

function isSavedQuote(value: unknown): value is SavedQuote {
  return (
    isRecord(value) &&
    isQuote(value) &&
    isNonEmptyString(value.savedAt) &&
    Number.isFinite(Date.parse(value.savedAt))
  );
}

export function parseSavedQuotes(storedValue: string | null): SavedQuote[] {
  if (storedValue === null) return [];

  try {
    const parsedValue: unknown = JSON.parse(storedValue);

    if (!Array.isArray(parsedValue)) return [];

    const ids = new Set<string>();
    return parsedValue
      .filter(isSavedQuote)
      .filter((quote) => {
        if (ids.has(quote.id)) return false;
        ids.add(quote.id);
        return true;
      })
      .map((quote) => {
        const recovered = { ...quote };
        if (!isNonEmptyString(recovered.clientId)) delete recovered.clientId;
        if (!isNonEmptyString(recovered.opportunityId)) delete recovered.opportunityId;
        return recovered;
      });
  } catch {
    return [];
  }
}

export function loadSavedQuotes(): SavedQuote[] {
  try {
    return parseSavedQuotes(localStorage.getItem(SAVED_QUOTES_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function saveQuote(quote: Quote): boolean {
  try {
    const savedQuote: SavedQuote = {
      id: quote.id,
      status: quote.status,
      ...(isNonEmptyString(quote.clientId) ? { clientId: quote.clientId } : {}),
      ...(isNonEmptyString(quote.opportunityId) ? { opportunityId: quote.opportunityId } : {}),
      clientName: quote.clientName,
      projectName: quote.projectName,
      lines: quote.lines,
      savedAt: new Date().toISOString(),
    };
    if (!isSavedQuote(savedQuote)) return false;
    const savedQuotes = readCollection(SAVED_QUOTES_STORAGE_KEY);
    const matching = savedQuotes.filter((saved) => hasRecordId(saved, quote.id));
    if (
      matching.length > 1 ||
      (matching.length === 1 && (!isSavedQuote(matching[0]) || matching[0].status === 'finalized'))
    )
      return false;
    const existingIndex = savedQuotes.findIndex((saved) => hasRecordId(saved, quote.id));

    if (existingIndex === -1) {
      savedQuotes.push(savedQuote);
    } else {
      savedQuotes[existingIndex] = savedQuote;
    }

    localStorage.setItem(SAVED_QUOTES_STORAGE_KEY, JSON.stringify(savedQuotes));
    return true;
  } catch {
    return false;
  }
}

export const saveQuoteDraft = saveQuote;
