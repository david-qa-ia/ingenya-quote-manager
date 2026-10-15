import { describe, expect, it } from 'vitest';
import { getContactEligibility, renderContactScript } from './contactAssistant';
import { getContactScriptTokenErrors, isContactScriptTemplate } from './contactScriptStorage';

const client = {
  id: 'client',
  name: 'Ana',
  phone: '3415550101',
  email: 'ana@example.com',
  preferredChannel: 'whatsapp' as const,
  contactConsent: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const quote = {
  id: 'PRES-1',
  status: 'finalized' as const,
  commercialStatus: 'sent' as const,
  commercialStatusAudit: {
    changedAt: '2026-01-01T00:00:00.000Z',
    changedBy: 'Daniel',
    reason: 'ok',
  },
  clientName: 'Ana',
  projectName: 'Obra',
  lines: [
    {
      id: 'line',
      name: 'Pintura',
      unit: 'unit' as const,
      quantity: 1,
      unitPrice: 100,
      source: 'manual' as const,
    },
  ],
};
describe('contact assistant rules', () => {
  it('renders only known variables and reports absent values', () => {
    expect(
      renderContactScript('Hola {{cliente}}, {{empresa}}', { client, quote }).tokenErrors,
    ).not.toEqual([]);
    expect(
      renderContactScript('Hola {{cliente}}, {{responsable}}', { client, quote }).missing,
    ).toEqual(['responsable']);
  });
  it('keeps multiple services pending instead of choosing one', () => {
    expect(
      renderContactScript('{{servicio}}', {
        client,
        quote: {
          ...quote,
          lines: [...quote.lines, { ...quote.lines[0], id: 'two', name: 'Revoque' }],
        },
      }).missing,
    ).toEqual(['servicio']);
  });
  it('blocks no-contact, consent and pending phones', () => {
    expect(
      getContactEligibility(
        {
          client: {
            ...client,
            doNotContact: { reason: 'pedido', recordedAt: client.createdAt, recordedBy: 'Ana' },
          },
          quote,
        },
        'call',
      ),
    ).toMatch(/solicitó/);
    expect(
      getContactEligibility({ client: { ...client, contactConsent: false }, quote }, 'whatsapp'),
    ).toMatch(/consentimiento/);
    expect(
      getContactEligibility({ client: { ...client, phone: '1111111111' }, quote }, 'call'),
    ).toMatch(/pendiente/);
  });
  it('validates template tokens and snapshots-compatible templates', () => {
    expect(getContactScriptTokenErrors('Hola {{cliente')).not.toEqual([]);
    expect(
      isContactScriptTemplate({
        id: 'script',
        name: 'Saludo',
        channel: 'whatsapp',
        content: 'Hola {{cliente}}',
        variables: ['cliente'],
        status: 'active',
        createdBy: 'Daniel',
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
        version: 1,
      }),
    ).toBe(true);
  });
});
