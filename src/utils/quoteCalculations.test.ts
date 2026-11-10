import { describe, expect, it } from 'vitest';
import type { QuoteLine } from '../types/quote';
import {
  calculateLineSubtotal,
  calculateQuoteTotal,
  getQuoteDiscountError,
  getQuoteTotals,
  isQuoteDiscount,
} from './quoteCalculations';

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

describe('quote discount (owner, 2026-11-09)', () => {
  const line = (quantity: number, unitPrice: number): QuoteLine => ({
    id: `line-${quantity}-${unitPrice}`,
    name: 'Servicio',
    unit: 'unit',
    quantity,
    unitPrice,
    source: 'manual',
  });
  const services = [line(1, 60000), line(2, 20000)];

  it('shows subtotal, discount and final total ("Descuento 10% −$10.000")', () => {
    expect(getQuoteTotals(services, { type: 'percent', value: 10 })).toEqual({
      subtotal: 100000,
      discountAmount: 10000,
      discountLabel: 'Descuento 10%',
      total: 90000,
    });
    expect(getQuoteTotals(services, undefined)).toMatchObject({ discountAmount: 0, total: 100000 });
  });

  it('recalculates a percentage when services change and keeps an amount fixed', () => {
    const more = [...services, line(1, 100000)];
    expect(calculateQuoteTotal(more, { type: 'percent', value: 10 })).toBe(180000);
    expect(calculateQuoteTotal(services, { type: 'amount', value: 15000 })).toBe(85000);
    expect(calculateQuoteTotal(more, { type: 'amount', value: 15000 })).toBe(185000);
  });

  it('accepts 0% to 100% and $0 up to the subtotal; above it asks to adjust', () => {
    expect(getQuoteDiscountError({ type: 'percent', value: 100 }, 100000)).toBeNull();
    expect(getQuoteDiscountError({ type: 'percent', value: 101 }, 100000)).toBe(
      'El descuento tiene que ser de 0% a 100%.',
    );
    expect(getQuoteDiscountError({ type: 'amount', value: 100000 }, 100000)).toBeNull();
    expect(getQuoteDiscountError({ type: 'amount', value: 100001 }, 100000)).toMatch(
      /^El descuento supera el subtotal \(.*100\.000\)\. Ajustalo antes de finalizar\.$/,
    );
    // While the draft is being fixed the total never goes below zero.
    expect(calculateQuoteTotal([line(1, 5000)], { type: 'amount', value: 15000 })).toBe(0);
  });

  it('only accepts well-formed stored discounts', () => {
    expect(isQuoteDiscount({ type: 'percent', value: 15 })).toBe(true);
    expect(isQuoteDiscount({ type: 'amount', value: 250000 })).toBe(true);
    expect(isQuoteDiscount({ type: 'percent', value: 150 })).toBe(false);
    expect(isQuoteDiscount({ type: 'fixed', value: 10 })).toBe(false);
    expect(isQuoteDiscount({ type: 'amount', value: -1 })).toBe(false);
  });
});
