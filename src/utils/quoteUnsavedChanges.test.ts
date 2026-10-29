import { describe, expect, it } from 'vitest';
import type { Quote, QuoteLine, SavedQuote } from '../types/quote';
import { hasUnsavedQuoteChanges } from './quoteUnsavedChanges';

const line: QuoteLine = {
  id: 'line-1',
  name: 'Pintura',
  unit: 'unit',
  quantity: 3,
  unitPrice: 20000,
  source: 'manual',
};
const draft: Quote = {
  id: 'PRES-1',
  status: 'draft',
  commercialStatus: 'prepared',
  commercialStatusAudit: {
    changedAt: '2026-10-28T12:00:00Z',
    changedBy: 'QA',
    reason: 'Preparado',
  },
  clientName: '',
  projectName: '',
  lines: [],
};
const saved = (quote: Quote): SavedQuote => ({ ...quote, savedAt: '2026-10-28T12:00:00Z' });

describe('hasUnsavedQuoteChanges (SCRUM-97)', () => {
  it('ignores an empty new draft', () => {
    expect(hasUnsavedQuoteChanges(draft, undefined)).toBe(false);
  });

  it('flags a new draft with service lines that was never saved', () => {
    expect(hasUnsavedQuoteChanges({ ...draft, lines: [line] }, undefined)).toBe(true);
  });

  it('does not flag a draft that matches its saved version', () => {
    const quote = { ...draft, lines: [line], projectName: 'Obra QA' };
    expect(hasUnsavedQuoteChanges(quote, saved(quote))).toBe(false);
  });

  it('flags a saved draft whose lines or association changed', () => {
    const quote = { ...draft, lines: [line] };
    expect(
      hasUnsavedQuoteChanges({ ...quote, lines: [{ ...line, quantity: 4 }] }, saved(quote)),
    ).toBe(true);
    expect(hasUnsavedQuoteChanges({ ...quote, projectName: 'Otra obra' }, saved(quote))).toBe(true);
  });

  it('never flags a finalized quote, which is not editable', () => {
    expect(
      hasUnsavedQuoteChanges({ ...draft, status: 'finalized', lines: [line] }, undefined),
    ).toBe(false);
  });
});
