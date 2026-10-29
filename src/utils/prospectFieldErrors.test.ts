import { describe, expect, it } from 'vitest';
import type { ProspectInput } from '../types/prospect';
import {
  getProspectConversionFieldErrors,
  getProspectConversionValidationError,
  prospectConversionFieldOrder,
  type ProspectConversionInput,
} from './prospectConversion';
import {
  getProspectFieldErrors,
  getProspectSaveErrorMessage,
  getProspectValidationError,
  prospectFieldOrder,
} from './prospectStorage';

const prospect: ProspectInput = {
  name: 'QA-P01 Prospecto',
  company: '',
  phone: '',
  email: '',
  instagram: '',
  address: '',
  source: 'Referencia',
  potentialService: '',
  notes: '',
  status: 'uncontacted',
  priority: 'medium',
  priorityReason: '',
  nextAction: '',
  nextActionAt: '',
  responsible: '',
  preferredChannel: '',
};

const firstOf = <F extends string>(errors: Partial<Record<F, string>>, order: readonly F[]) => {
  const field = order.find((key) => errors[key]);
  return field ? errors[field] : null;
};

describe('getProspectFieldErrors (SCRUM-107)', () => {
  it.each([
    ['valid prospect', {}],
    ['pending values stay valid', { phone: '1111111111', email: 'none' }],
    ['empty name', { name: '  ' }],
    ['short phone', { phone: '123' }],
    ['phone with letters', { phone: '341-abc-1234' }],
    ['invalid email', { email: 'qa@' }],
    ['name, phone and email', { name: '', phone: '12', email: 'x' }],
    ['invalid priority', { priority: 'urgent' as ProspectInput['priority'] }],
    ['invalid channel', { preferredChannel: 'fax' as ProspectInput['preferredChannel'] }],
    ['invalid follow-up date', { nextActionAt: 'mañana' }],
  ])('reports the same first error as getProspectValidationError: %s', (_label, change) => {
    const input = { ...prospect, ...change };
    expect(firstOf(getProspectFieldErrors(input), prospectFieldOrder)).toBe(
      getProspectValidationError(input),
    );
  });

  it('reports every invalid field with its own message', () => {
    expect(getProspectFieldErrors({ ...prospect, name: '', phone: '12', email: 'x' })).toEqual({
      name: 'Ingresá el nombre del prospecto.',
      phone: 'El teléfono debe tener entre 7 y 15 dígitos.',
      email: 'Ingresá un email válido o none si está pendiente.',
    });
  });

  it('never exposes the internal save reason', () => {
    for (const reason of ['validation', 'storage_unavailable', 'storage_write_failed'] as const) {
      const message = getProspectSaveErrorMessage({ ok: false, reason, error: 'raw detail' });
      expect(message).not.toMatch(/validation|storage|raw detail|\(/);
    }
  });
});

const conversion: ProspectConversionInput = {
  opportunityName: 'Pintura QA',
  serviceOfInterest: 'Pintura interior',
  interestLevel: 'medium',
  detectedNeed: 'Pintar 3 ambientes',
  estimatedValue: '',
  nextStep: 'Enviar presupuesto',
  nextStepAt: '2099-11-02T10:00',
  nextStepChannel: 'call',
  responsible: 'QA Tester',
};

describe('getProspectConversionFieldErrors (SCRUM-107)', () => {
  it.each([
    ['valid input', {}],
    ['empty name', { opportunityName: '' }],
    ['negative value', { estimatedValue: '-5' }],
    ['missing channel', { nextStepChannel: '' as ProspectConversionInput['nextStepChannel'] }],
    ['invalid date', { nextStepAt: '' }],
    ['several fields', { detectedNeed: '', nextStep: '', responsible: ' ' }],
  ])('reports the same first error as the existing validator: %s', (_label, change) => {
    const input = { ...conversion, ...change };
    expect(firstOf(getProspectConversionFieldErrors(input), prospectConversionFieldOrder)).toBe(
      getProspectConversionValidationError(input),
    );
  });

  it('marks each missing field separately', () => {
    expect(
      Object.keys(
        getProspectConversionFieldErrors({
          ...conversion,
          detectedNeed: '',
          nextStep: '',
          responsible: '',
        }),
      ),
    ).toEqual(['detectedNeed', 'nextStep', 'responsible']);
  });
});
