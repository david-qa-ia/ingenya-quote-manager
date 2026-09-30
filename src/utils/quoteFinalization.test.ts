import { describe, expect, it } from 'vitest';
import type { Quote } from '../types/quote';
import { finalizeQuote } from './quoteFinalization';

const validQuote: Quote = {
  id: 'PRES-2026-0001',
  status: 'draft',
  clientName: 'Ana Pérez',
  projectName: 'Reforma cocina',
  lines: [
    {
      id: 'line-1',
      name: 'Revisión sin cargo',
      unit: 'unit',
      quantity: 1,
      unitPrice: 0,
      source: 'manual',
    },
  ],
};

describe('finalizeQuote', () => {
  it('finalizes a valid draft without mutating it', () => {
    const original = structuredClone(validQuote);

    expect(finalizeQuote(validQuote)).toEqual({ ...validQuote, status: 'finalized' });
    expect(validQuote).toEqual(original);
  });

  it('rejects a quote without lines', () => {
    expect(() => finalizeQuote({ ...validQuote, lines: [] })).toThrow(
      'Agregá al menos un servicio antes de finalizar el presupuesto.',
    );
  });

  it.each([
    { name: ' ', unit: 'unit', quantity: 1, unitPrice: 1 },
    { name: 'Servicio', unit: 'invalid', quantity: 1, unitPrice: 1 },
    { name: 'Servicio', unit: 'unit', quantity: Number.NaN, unitPrice: 1 },
    { name: 'Servicio', unit: 'unit', quantity: 0, unitPrice: 1 },
    { name: 'Servicio', unit: 'unit', quantity: 1, unitPrice: Number.POSITIVE_INFINITY },
    { name: 'Servicio', unit: 'unit', quantity: 1, unitPrice: -1 },
  ])('rejects a draft with an invalid line', (invalidValues) => {
    const invalidLine = { ...validQuote.lines[0], ...invalidValues } as Quote['lines'][number];

    expect(() => finalizeQuote({ ...validQuote, lines: [invalidLine] })).toThrow(
      'Revisá los servicios',
    );
  });

  it('does not allow a finalized quote to transition again', () => {
    expect(() => finalizeQuote({ ...validQuote, status: 'finalized' })).toThrow(
      'El presupuesto ya está finalizado.',
    );
  });
});
