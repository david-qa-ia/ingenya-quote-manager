import { describe, expect, it } from 'vitest';
import type { QuoteDraft } from '../types/quote';
import type { DeploymentBrandConfig } from '../types/branding';
import {
  createSafeQuotePdfFileName,
  prepareQuotePdfModel,
  quotePdfConditions,
} from './quotePdfModel';

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
      title: 'Propuesta de servicios',
      recipient: { name: 'Sin cliente', company: '', phone: '', email: '' },
      siteAddress: '',
      total: 187500,
      fileName: 'presupuesto-PRES-2026-0001.pdf',
      isDraft: true,
      lines: [
        {
          name: 'Pintar pared',
          details: '',
          unit: 'm²',
          quantity: 12.5,
          unitPrice: 15000,
          subtotal: 187500,
        },
        {
          name: 'Revisión sin cargo',
          details: '',
          unit: 'u',
          quantity: 1,
          unitPrice: 0,
          subtotal: 0,
        },
      ],
    });
    expect(input).toEqual(original);
  });

  it('prints the scope written for each service under its name', () => {
    const withScope = {
      ...draft,
      lines: [{ ...draft.lines[0], description: '  Látex lavable, dos manos.  ' }],
    };
    expect(prepareQuotePdfModel(withScope).lines[0]).toMatchObject({
      name: 'Pintar pared',
      details: 'Látex lavable, dos manos.',
    });
  });

  it('completes the client block and the job address from the linked records', () => {
    const model = prepareQuotePdfModel(draft, undefined, undefined, {
      client: { company: 'Constructora Sur', phone: '+54 9 341 555-1234', email: 'ana@sur.com' },
      opportunity: { address: ' Av. Pellegrini 1200, Rosario ' },
    });
    expect(model.recipient).toEqual({
      name: 'Ana Pérez',
      company: 'Constructora Sur',
      phone: '+54 9 341 555-1234',
      email: 'ana@sur.com',
    });
    expect(model.siteAddress).toBe('Av. Pellegrini 1200, Rosario');
    const sameAsName = prepareQuotePdfModel(draft, undefined, undefined, {
      client: { company: 'Ana Pérez', phone: '', email: '' },
    });
    expect(sameAsName.recipient.company).toBe('');
  });

  it('shows subtotal, discount and final total when the quote has a discount', () => {
    expect(
      prepareQuotePdfModel({ ...draft, discount: { type: 'percent', value: 10 } }),
    ).toMatchObject({
      subtotal: 187500,
      discountAmount: 18750,
      discountLabel: 'Descuento 10%',
      total: 168750,
    });
  });

  it('rejects a quote without lines', () => {
    expect(() => prepareQuotePdfModel({ ...draft, lines: [] })).toThrow(
      'Agregá al menos un servicio válido antes de descargar el PDF.',
    );
  });

  it('marks only drafts; a finalized quote carries no internal status for the client', () => {
    const finalized = prepareQuotePdfModel({ ...draft, status: 'finalized' });
    expect(finalized.isDraft).toBe(false);
    expect(JSON.stringify(finalized)).not.toMatch(/Finalizado|FINALIZADO/);
  });

  it('uses the project as the document title', () => {
    expect(prepareQuotePdfModel(draft).title).toBe('Reforma cocina');
  });

  it('explains the validity and how to accept with the company WhatsApp', () => {
    const brand: DeploymentBrandConfig = {
      companyName: 'Ventro',
      email: '',
      whatsapp: { display: '341 779-3657', value: '3417793657' },
      footerBusinessText: 'Ventro',
      quoteValidityDays: 15,
    };
    const model = prepareQuotePdfModel(draft, brand, new Date('2026-11-04T15:00:00.000Z'));
    expect(model.conditions).toEqual([
      {
        label: 'Validez',
        text: 'Los precios de este presupuesto se mantienen hasta el 19/11/2026.',
      },
    ]);
    expect(model.acceptanceText).toContain('por WhatsApp al 341 779-3657');
    const withoutWhatsapp = { ...brand, whatsapp: { display: '', value: '' } };
    expect(prepareQuotePdfModel(draft, withoutWhatsapp).acceptanceText).toContain(
      'respondiendo este envío',
    );
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

describe('quotePdfConditions', () => {
  const brand: DeploymentBrandConfig = {
    companyName: 'Obras Sur',
    email: '',
    whatsapp: { display: '', value: '' },
    footerBusinessText: 'Obras Sur',
  };

  it('prints only the conditions the workspace filled in, always ending with the validity', () => {
    const conditions = quotePdfConditions(
      {
        ...brand,
        quoteConditions: {
          paymentTerms: '50% al aceptar y 50% al terminar.',
          executionTime: ' ',
          included: 'Mano de obra y limpieza final.',
          excluded: '',
        },
      },
      '19/11/2026',
    );
    expect(conditions.map((condition) => condition.label)).toEqual([
      'Incluye',
      'Forma de pago',
      'Validez',
    ]);
    expect(conditions[1].text).toBe('50% al aceptar y 50% al terminar.');
  });

  it('keeps the validity alone when nothing was configured', () => {
    expect(quotePdfConditions(brand, '19/11/2026')).toEqual([
      {
        label: 'Validez',
        text: 'Los precios de este presupuesto se mantienen hasta el 19/11/2026.',
      },
    ]);
  });
});

describe('createSafeQuotePdfFileName', () => {
  it('replaces only unsafe characters in the quote id', () => {
    expect(createSafeQuotePdfFileName('PRES/2026:0001 válido')).toBe(
      'presupuesto-PRES-2026-0001-v-lido.pdf',
    );
  });
});
