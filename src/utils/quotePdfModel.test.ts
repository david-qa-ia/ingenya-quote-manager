import { describe, expect, it } from 'vitest';
import type { QuoteDraft } from '../types/quote';
import { createSafeQuotePdfFileName, prepareQuotePdfModel } from './quotePdfModel';

const draft: QuoteDraft = {
  id: 'PRES-2026-0001',
  status: 'draft',
  clientName: '  Ana Pérez  ',
  projectName: 'Reforma cocina',
  lines: [
    {
      id: 'line-1',
      name: 'Pintar pared',
      unit: 'squareMeter',
      quantity: 12.5,
      unitPrice: 15000,
      source: 'manual',
    },
    {
      id: 'line-2',
      name: 'Revisión sin cargo',
      unit: 'unit',
      quantity: 1,
      unitPrice: 0,
      source: 'manual',
    },
  ],
};

describe('prepareQuotePdfModel', () => {
  it('prepares fallbacks, line values, subtotals and total without changing the draft', () => {
    const input = structuredClone({ ...draft, clientName: ' ', projectName: '' });
    const original = structuredClone(input);

    expect(prepareQuotePdfModel(input)).toMatchObject({
      id: draft.id,
      clientName: 'Sin cliente',
      projectName: 'Sin obra',
      status: 'Borrador',
      total: 187500,
      fileName: 'presupuesto-PRES-2026-0001.pdf',
      lines: [
        {
          description: 'Pintar pared',
          unit: 'Metro cuadrado (m²)',
          quantity: 12.5,
          unitPrice: 15000,
          subtotal: 187500,
        },
        {
          description: 'Revisión sin cargo',
          unit: 'Unidad (u)',
          quantity: 1,
          unitPrice: 0,
          subtotal: 0,
        },
      ],
    });
    expect(input).toEqual(original);
  });

  it('rejects a quote without lines', () => {
    expect(() => prepareQuotePdfModel({ ...draft, lines: [] })).toThrow(
      'Agregá al menos un servicio válido antes de descargar el PDF.',
    );
  });

  it.each([
    { name: ' ', unit: 'unit', quantity: 1, unitPrice: 1 },
    { name: 'Servicio', unit: 'invalid', quantity: 1, unitPrice: 1 },
    { name: 'Servicio', unit: 'unit', quantity: Number.NaN, unitPrice: 1 },
    { name: 'Servicio', unit: 'unit', quantity: 0, unitPrice: 1 },
    { name: 'Servicio', unit: 'unit', quantity: 1, unitPrice: Number.POSITIVE_INFINITY },
    { name: 'Servicio', unit: 'unit', quantity: 1, unitPrice: -1 },
  ])('rejects the complete quote when a line is invalid', (invalidValues) => {
    const invalidLine = { ...draft.lines[0], ...invalidValues } as QuoteDraft['lines'][number];

    expect(() => prepareQuotePdfModel({ ...draft, lines: [draft.lines[0], invalidLine] })).toThrow(
      'No se puede generar el PDF porque uno o más servicios tienen datos inválidos.',
    );
  });
});

describe('createSafeQuotePdfFileName', () => {
  it('replaces only unsafe characters in the quote id', () => {
    expect(createSafeQuotePdfFileName('PRES/2026:0001 válido')).toBe(
      'presupuesto-PRES-2026-0001-v-lido.pdf',
    );
  });
});
