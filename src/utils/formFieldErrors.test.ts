import { describe, expect, it } from 'vitest';
import type { ClientInput } from '../types/client';
import type { OpportunityInput } from '../types/opportunity';
import { getActivityFormFieldErrors } from './activityFormValidation';
import { getClientFieldErrors, getClientValidationError } from './clientValidation';
import { getCommercialOutcomeFieldErrors } from './commercialOutcomeValidation';
import { getManualQuoteLineFieldErrors } from './manualQuoteLineValidation';
import {
  getOpportunityFormFieldErrors,
  getOpportunityValidationError,
} from './opportunityValidation';
import { getQuoteSendFieldErrors } from './quoteSendValidation';

const now = Date.parse('2026-10-28T15:00:00-03:00');

describe('getQuoteSendFieldErrors (SCRUM-107)', () => {
  const valid = {
    channel: 'whatsapp',
    sentAt: '2026-10-28T14:00',
    responsible: 'QA Tester',
    note: '',
    nextStep: 'none',
    nextStepAt: '',
  };
  it('accepts a complete send', () => {
    expect(getQuoteSendFieldErrors(valid, now)).toEqual({});
  });
  it('reports every invalid field with the existing messages', () => {
    expect(
      getQuoteSendFieldErrors(
        {
          ...valid,
          channel: 'other',
          sentAt: '2026-10-29T10:00',
          responsible: ' ',
          nextStep: 'call',
          nextStepAt: '2026-10-28T10:00',
        },
        now,
      ),
    ).toEqual({
      responsible: 'Indicá quién registró el envío.',
      sentAt: 'La fecha y hora de envío debe ser válida y no futura.',
      nextStepAt: 'El próximo paso debe tener una fecha futura.',
      note: 'Indicá una nota para registrar otro canal.',
    });
  });
});

describe('getCommercialOutcomeFieldErrors (SCRUM-107)', () => {
  it('splits the previous combined message per field', () => {
    expect(
      getCommercialOutcomeFieldErrors({
        needsReason: true,
        reasonCode: 'other',
        note: '',
        author: '',
      }),
    ).toEqual({
      note: 'Ingresá una nota: es obligatoria cuando el motivo es “Otro”.',
      author: 'Ingresá el autor del resultado.',
    });
    expect(
      getCommercialOutcomeFieldErrors({
        needsReason: true,
        reasonCode: 'price',
        note: '',
        author: 'QA',
      }),
    ).toEqual({});
  });
});

describe('getClientFieldErrors (SCRUM-107)', () => {
  const client: ClientInput = {
    name: 'QA-P02 Cliente',
    phone: '3415550102',
    email: 'qa-p02@example.test',
    preferredChannel: '',
    contactConsent: false,
  };
  it.each([
    ['valid client', {}],
    ['pending values', { phone: '1111111111', email: 'none' }],
    ['company instead of name', { name: '', company: 'QA SRL' }],
    ['no name nor company', { name: '' }],
    ['invalid phone', { phone: '12' }],
    ['invalid email', { email: 'qa@' }],
    [
      'no-contact request without reason',
      { doNotContact: { reason: '', recordedAt: '2026-10-28T12:00:00Z', recordedBy: 'QA' } },
    ],
    [
      'no-contact request without author',
      { doNotContact: { reason: 'Pedido', recordedAt: '2026-10-28T12:00:00Z', recordedBy: '' } },
    ],
  ])('is valid exactly when getClientValidationError is: %s', (_label, change) => {
    const input = { ...client, ...change } as ClientInput;
    expect(Object.keys(getClientFieldErrors(input)).length === 0).toBe(
      getClientValidationError(input) === null,
    );
  });
});

describe('getOpportunityFormFieldErrors (SCRUM-107)', () => {
  const input: OpportunityInput = {
    clientId: 'client',
    name: 'Obra QA',
    address: '',
    estimatedStartDate: '',
    responsibleSeller: '',
  };
  it.each([
    ['valid', {}],
    ['empty name', { name: ' ' }],
    ['invalid date', { estimatedStartDate: '2026-02-30' }],
  ])('uses the same messages as getOpportunityValidationError: %s', (_label, change) => {
    const next = { ...input, ...change };
    const errors = getOpportunityFormFieldErrors(next);
    expect(errors.name ?? errors.estimatedStartDate ?? null).toBe(
      getOpportunityValidationError(next),
    );
  });
});

describe('getActivityFormFieldErrors (SCRUM-107)', () => {
  it('requires date and result only for activities, not for notes', () => {
    const empty = { type: 'call', occurredAt: '', author: '', result: '', note: '' };
    expect(Object.keys(getActivityFormFieldErrors({ noteOnly: false, ...empty }))).toEqual([
      'occurredAt',
      'author',
      'result',
      'note',
    ]);
    expect(Object.keys(getActivityFormFieldErrors({ noteOnly: true, ...empty }))).toEqual([
      'author',
      'note',
    ]);
  });
});

describe('getManualQuoteLineFieldErrors (SCRUM-107)', () => {
  it('reports name, quantity and price separately', () => {
    expect(getManualQuoteLineFieldErrors({ name: '', quantity: '0', unitPrice: '' })).toEqual({
      name: 'Ingresá el nombre del servicio.',
      quantity: 'Ingresá una cantidad mayor a cero.',
      unitPrice: 'Ingresá un precio unitario igual o mayor a cero.',
    });
    expect(
      getManualQuoteLineFieldErrors({ name: 'Pintura', quantity: '2', unitPrice: '0' }),
    ).toEqual({});
  });
});
