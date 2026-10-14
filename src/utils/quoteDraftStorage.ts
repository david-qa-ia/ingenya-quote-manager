import { hasRecordId, readCollection } from './localCollectionStorage';
import type {
  CommercialStatus,
  CommercialStatusAudit,
  Quote,
  QuoteLine,
  QuoteLineSource,
  QuoteStatus,
  SavedQuote,
  WorkUnit,
} from '../types/quote';
import {
  assertCommercialTransition,
  createMigratedPreparedCommercialAudit,
  isCommercialStatus,
  isCommercialStatusAudit,
} from './quoteCommercialStatus';

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

function isQuoteBase(
  value: unknown,
): value is Omit<Quote, 'commercialStatus' | 'commercialStatusAudit'> {
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

function isSavedQuoteBase(
  value: unknown,
): value is Omit<SavedQuote, 'commercialStatus' | 'commercialStatusAudit'> {
  const record = value as Record<string, unknown>;
  return (
    isRecord(value) &&
    isQuoteBase(value) &&
    isNonEmptyString(record.savedAt) &&
    Number.isFinite(Date.parse(record.savedAt))
  );
}

function recoverSavedQuote(value: unknown): SavedQuote | null {
  if (!isSavedQuoteBase(value)) return null;

  const quote = value as Record<string, unknown>;
  const commercialStatus: CommercialStatus = isCommercialStatus(quote.commercialStatus)
    ? quote.commercialStatus
    : 'prepared';
  const commercialStatusAudit: CommercialStatusAudit = isCommercialStatusAudit(
    quote.commercialStatusAudit,
  )
    ? quote.commercialStatusAudit
    : createMigratedPreparedCommercialAudit(quote.savedAt as string);
  const recovered: SavedQuote = {
    ...(quote as Omit<SavedQuote, 'commercialStatus' | 'commercialStatusAudit'>),
    commercialStatus,
    commercialStatusAudit,
  };
  if (isCommercialStatusAudit(quote.sentAudit)) recovered.sentAudit = quote.sentAudit;
  return recovered;
}

export function parseSavedQuotes(storedValue: string | null): SavedQuote[] {
  if (storedValue === null) return [];

  try {
    const parsedValue: unknown = JSON.parse(storedValue);

    if (!Array.isArray(parsedValue)) return [];

    const ids = new Set<string>();
    return parsedValue
      .map(recoverSavedQuote)
      .filter((quote): quote is SavedQuote => quote !== null)
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
      commercialStatus: quote.commercialStatus,
      commercialStatusAudit: quote.commercialStatusAudit,
      ...(quote.sentAudit ? { sentAudit: quote.sentAudit } : {}),
      ...(isNonEmptyString(quote.clientId) ? { clientId: quote.clientId } : {}),
      ...(isNonEmptyString(quote.opportunityId) ? { opportunityId: quote.opportunityId } : {}),
      clientName: quote.clientName,
      projectName: quote.projectName,
      lines: quote.lines,
      savedAt: new Date().toISOString(),
    };
    if (!recoverSavedQuote(savedQuote)) return false;
    const savedQuotes = readCollection(SAVED_QUOTES_STORAGE_KEY);
    const matching = savedQuotes.filter((saved) => hasRecordId(saved, quote.id));
    if (
      matching.length > 1 ||
      (matching.length === 1 &&
        (!recoverSavedQuote(matching[0]) || recoverSavedQuote(matching[0])?.status === 'finalized'))
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

export function saveFinalizedQuoteCommercialState(
  quoteId: string,
  commercialStatus: CommercialStatus,
  commercialStatusAudit: CommercialStatusAudit,
  sentAudit?: CommercialStatusAudit,
): boolean {
  try {
    if (!isCommercialStatus(commercialStatus) || !isCommercialStatusAudit(commercialStatusAudit))
      return false;
    if (sentAudit && !isCommercialStatusAudit(sentAudit)) return false;
    const savedQuotes = readCollection(SAVED_QUOTES_STORAGE_KEY);
    const matching = savedQuotes.filter((saved) => hasRecordId(saved, quoteId));
    if (matching.length !== 1) return false;
    const existing = recoverSavedQuote(matching[0]);
    if (!existing || existing.status !== 'finalized') return false;
    assertCommercialTransition(existing.commercialStatus, commercialStatus, existing.status);
    if (commercialStatus === 'sent' && !sentAudit) return false;
    const existingIndex = savedQuotes.findIndex((saved) => hasRecordId(saved, quoteId));
    savedQuotes[existingIndex] = {
      ...existing,
      commercialStatus,
      commercialStatusAudit,
      ...(sentAudit ? { sentAudit } : {}),
    };
    localStorage.setItem(SAVED_QUOTES_STORAGE_KEY, JSON.stringify(savedQuotes));
    return true;
  } catch {
    return false;
  }
}

export const saveQuoteDraft = saveQuote;
