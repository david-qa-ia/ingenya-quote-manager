import { describe, expect, it } from 'vitest';
import type { QuoteLine } from '../types/quote';
import { calculateLineSubtotal, calculateQuoteTotal } from './quoteCalculations';

describe('calculateLineSubtotal', () => {
  it('calculates quantity multiplied by unit price', () => {
    expect(calculateLineSubtotal(30, 50000)).toBe(1500000);
  });

  it('supports decimal quantities', () => {
    expect(calculateLineSubtotal(18.5, 12000)).toBe(222000);
  });

  it('returns zero when the quantity is zero', () => {
    expect(calculateLineSubtotal(0, 50000)).toBe(0);
  });
});

describe('calculateQuoteTotal', () => {
  it('adds the subtotal of every quote line', () => {
    const lines: QuoteLine[] = [
      {
        id: 'line-1',
        catalogJobId: 'build-wall',
        name: 'Levantar pared',
        unit: 'squareMeter',
        quantity: 30,
        unitPrice: 50000,
        source: 'catalog',
      },
      {
        id: 'line-2',
        name: 'Instalar puerta',
        unit: 'unit',
        quantity: 2,
        unitPrice: 120000,
        source: 'manual',
      },
    ];

    expect(calculateQuoteTotal(lines)).toBe(1740000);
  });

  it('returns zero when there are no quote lines', () => {
    expect(calculateQuoteTotal([])).toBe(0);
  });
});
