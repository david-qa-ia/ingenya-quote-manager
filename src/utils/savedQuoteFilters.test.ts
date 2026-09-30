import { describe, expect, it } from 'vitest';
import type { SavedQuote } from '../types/quote';
import { filterSavedQuotes } from './savedQuoteFilters';

const savedQuotes: SavedQuote[] = [
  {
    id: 'PRES-2026-0001',
    status: 'draft',
    clientName: 'Ana Pérez',
    projectName: 'Reforma cocina',
    lines: [],
    savedAt: '2026-09-28T12:00:00.000Z',
  },
  {
    id: 'PRES-2026-0002',
    status: 'finalized',
    clientName: 'Luis Gómez',
    projectName: 'Pintura exterior',
    lines: [
      {
        id: 'line-1',
        name: 'Pintar pared',
        unit: 'squareMeter',
        quantity: 20,
        unitPrice: 15000,
        source: 'manual',
      },
    ],
    savedAt: '2026-09-29T12:00:00.000Z',
  },
  {
    id: 'PRES-2026-0003',
    status: 'draft',
    clientName: '',
    projectName: '',
    lines: [],
    savedAt: '2026-09-30T12:00:00.000Z',
  },
];

describe('filterSavedQuotes', () => {
  it('shows every saved quote for the all filter in its original order', () => {
    expect(filterSavedQuotes(savedQuotes, 'all').map((quote) => quote.id)).toEqual([
      'PRES-2026-0001',
      'PRES-2026-0002',
      'PRES-2026-0003',
    ]);
  });

  it('shows only drafts for the draft filter', () => {
    expect(filterSavedQuotes(savedQuotes, 'draft').map((quote) => quote.id)).toEqual([
      'PRES-2026-0001',
      'PRES-2026-0003',
    ]);
  });

  it('shows only finalized quotes for the finalized filter', () => {
    expect(filterSavedQuotes(savedQuotes, 'finalized').map((quote) => quote.id)).toEqual([
      'PRES-2026-0002',
    ]);
  });

  it('returns an empty collection when the selected status has no matches', () => {
    expect(filterSavedQuotes([savedQuotes[0]], 'finalized')).toEqual([]);
  });

  it('does not mutate quotes or their order while filtering', () => {
    const original = structuredClone(savedQuotes);

    filterSavedQuotes(savedQuotes, 'draft');

    expect(savedQuotes).toEqual(original);
  });
});
