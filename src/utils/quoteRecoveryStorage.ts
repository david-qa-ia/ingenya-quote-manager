import type { Quote, SavedQuote } from '../types/quote';
import { parseSavedQuotes } from './quoteDraftStorage';
import { workspaceStorageKey } from './workspaceStorage';

/**
 * SCRUM-118: the quote being built is kept in this browser while it has unsaved changes, so a
 * reload or a closed tab does not lose it. It is only a recovery copy: it never becomes a saved
 * draft until the user chooses "Recuperar" and then saves it.
 */
export const QUOTE_RECOVERY_STORAGE_KEY = 'ingenya.quoteRecovery.v1';

export function saveQuoteRecovery(quote: Quote, now = new Date()): void {
  try {
    const snapshot: SavedQuote = { ...quote, savedAt: now.toISOString() };
    localStorage.setItem(workspaceStorageKey(QUOTE_RECOVERY_STORAGE_KEY), JSON.stringify(snapshot));
  } catch {
    // Recovery is best effort; the editor keeps working without it.
  }
}

export function clearQuoteRecovery(): void {
  try {
    localStorage.removeItem(workspaceStorageKey(QUOTE_RECOVERY_STORAGE_KEY));
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}

/** The recovery copy, validated with the same rules as saved quotes; null when absent or invalid. */
export function loadQuoteRecovery(): SavedQuote | null {
  try {
    const stored = localStorage.getItem(workspaceStorageKey(QUOTE_RECOVERY_STORAGE_KEY));
    if (!stored) return null;
    const [quote] = parseSavedQuotes(`[${stored}]`);
    return quote && quote.status === 'draft' && quote.lines.length > 0 ? quote : null;
  } catch {
    return null;
  }
}

/**
 * Whether the recovery copy still adds something: it is pointless when the same quote was saved
 * afterwards with the same content.
 */
export function isQuoteRecoveryUseful(
  recovery: SavedQuote | null,
  savedQuotes: readonly SavedQuote[],
): recovery is SavedQuote {
  if (!recovery) return false;
  const saved = savedQuotes.find((quote) => quote.id === recovery.id);
  if (!saved) return true;
  const content = (quote: Quote) =>
    JSON.stringify([
      quote.lines,
      quote.discount ?? null,
      quote.clientName ?? '',
      quote.projectName ?? '',
    ]);
  return saved.status === 'draft' && content(saved) !== content(recovery);
}
