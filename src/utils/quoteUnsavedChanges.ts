import type { Quote, SavedQuote } from '../types/quote';

const editableFields = (quote: Quote) => ({
  lines: quote.lines,
  clientId: quote.clientId ?? null,
  opportunityId: quote.opportunityId ?? null,
  clientName: quote.clientName ?? '',
  projectName: quote.projectName ?? '',
});

/**
 * Whether the quote in the editor has work that would be lost if it were replaced (SCRUM-97).
 * Only drafts are editable; a draft that was never saved counts once it has a service line,
 * and a saved draft counts when its lines or association differ from the saved version.
 */
export function hasUnsavedQuoteChanges(current: Quote, saved: SavedQuote | undefined): boolean {
  if (current.status !== 'draft') return false;
  if (!saved) return current.lines.length > 0;
  return JSON.stringify(editableFields(current)) !== JSON.stringify(editableFields(saved));
}
