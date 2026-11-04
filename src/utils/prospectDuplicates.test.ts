import { describe, expect, it } from 'vitest';
import type { Prospect } from '../types/prospect';
import { findProspectDuplicates, getProspectContactRequirementError } from './prospectDuplicates';

const base: Prospect = {
  id: 'p1',
  name: 'Juan Pérez',
  company: 'Distribuidora Sur',
  phone: '+54 9 341 555-1234',
  email: 'juan@dsur.com',
  instagram: '@dsur',
  source: '',
  potentialService: '',
  notes: '',
  status: 'uncontacted',
  priority: 'medium',
  priorityReason: 'Manual',
  nextAction: '',
  nextActionAt: '',
  responsible: '',
  preferredChannel: '',
  activities: [],
  createdAt: '2026-11-04T00:00:00Z',
  updatedAt: '2026-11-04T00:00:00Z',
};
const candidate = (values: Partial<Prospect>) => ({
  ...base,
  id: 'new',
  name: '',
  company: '',
  phone: '',
  email: '',
  instagram: '',
  ...values,
});

describe('prospect duplicates (SCRUM-118)', () => {
  it.each([
    [{ phone: '341 5551234' }, ['phone']],
    [{ email: 'JUAN@dsur.com ' }, ['email']],
    [{ instagram: 'https://instagram.com/dsur/' }, ['instagram']],
    [{ name: 'juan perez', company: 'distribuidora  sur' }, ['nameAndCompany']],
  ])('finds the existing prospect by %j', (values, reasons) => {
    expect(findProspectDuplicates(candidate(values), [base])).toEqual([
      { prospect: base, reasons },
    ]);
  });

  it('ignores pending placeholders, the prospect itself and partial name matches', () => {
    const pending = { ...base, id: 'p2', phone: '1111111111', email: 'none', instagram: '' };
    expect(
      findProspectDuplicates(candidate({ phone: '1111111111', email: 'none' }), [pending]),
    ).toEqual([]);
    expect(findProspectDuplicates(base, [base])).toEqual([]);
    expect(findProspectDuplicates(candidate({ name: 'Juan Pérez' }), [base])).toEqual([]);
  });
});

describe('contact requirement for new prospects (SCRUM-118)', () => {
  it('asks for at least one way to reach the prospect', () => {
    expect(getProspectContactRequirementError({ phone: '', email: '', instagram: '' })).toBe(
      'Cargá al menos un teléfono, email o Instagram para poder contactarlo.',
    );
    expect(
      getProspectContactRequirementError({ phone: '1111111111', email: 'none', instagram: '' }),
    ).not.toBeNull();
    expect(
      getProspectContactRequirementError({ phone: '', email: '', instagram: '@x' }),
    ).toBeNull();
    expect(
      getProspectContactRequirementError({ phone: '3415551234', email: '', instagram: '' }),
    ).toBeNull();
  });
});
