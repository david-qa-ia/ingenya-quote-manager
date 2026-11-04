import { describe, expect, it } from 'vitest';
import type { QuoteDraft } from '../types/quote';
import type { DeploymentBrandConfig } from '../types/branding';
import { createSafeQuotePdfFileName, prepareQuotePdfModel } from './quotePdfModel';

const draft: QuoteDraft = {
  id: 'PRES-2026-0001',
  status: 'draft',
  commercialStatus: 'prepared',
  commercialStatusAudit: {
    changedAt: '2026-09-28T12:00:00.000Z',
    changedBy: 'Sistema local',
    reason: 'Estado comercial inicial al crear el presupuesto.',
  },
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
      projectName: 'Sin proyecto',
      status: 'Borrador',
      total: 187500,
      fileName: 'presupuesto-PRES-2026-0001.pdf',
      proposalTitle: 'Propuesta de servicios',
      isDraft: true,
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

  it('shows the real status of a finalized quote', () => {
    expect(prepareQuotePdfModel({ ...draft, status: 'finalized' })).toMatchObject({
      status: 'Finalizado',
      isDraft: false,
    });
  });

  it('uses the project as proposal title without expanding the quote contract', () => {
    expect(prepareQuotePdfModel(draft).proposalTitle).toBe('Reforma cocina');
  });

  it('preserves optional branding without inventing logo or Instagram', () => {
    const brand: DeploymentBrandConfig = {
      companyName: 'Otra empresa',
      email: 'contacto@example.com',
      whatsapp: { display: '123', value: '123' },
      footerBusinessText: 'Otra empresa - Servicios',
    };

    expect(prepareQuotePdfModel(draft, brand).brand).toEqual(brand);
  });

  it('only requires the company name; missing contact data is left out (SCRUM-119)', () => {
    const withoutEmail: DeploymentBrandConfig = {
      companyName: 'Otra empresa',
      email: '',
      whatsapp: { display: '', value: '' },
      footerBusinessText: 'Otra empresa - Servicios',
    };
    expect(prepareQuotePdfModel(draft, withoutEmail).brand.email).toBe('');
    expect(() => prepareQuotePdfModel(draft, { ...withoutEmail, companyName: ' ' })).toThrow(
      'No se puede generar el PDF porque la configuración comercial está incompleta.',
    );
  });

  it('dates the quote and adds the validity from the company data (SCRUM-119)', () => {
    const brand: DeploymentBrandConfig = {
      companyName: 'Ventro',
      email: '',
      whatsapp: { display: '', value: '' },
      footerBusinessText: 'Ventro',
      quoteValidityDays: 15,
    };
    const now = new Date('2026-11-04T15:00:00.000Z');
    expect(prepareQuotePdfModel(draft, brand, now)).toMatchObject({
      issuedOn: '04/11/2026',
      validUntil: '19/11/2026',
    });
    const finalized = {
      ...draft,
      status: 'finalized' as const,
      savedAt: '2026-10-01T15:00:00.000Z',
    };
    expect(prepareQuotePdfModel(finalized, brand, now)).toMatchObject({
      issuedOn: '01/10/2026',
      validUntil: '16/10/2026',
    });
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
