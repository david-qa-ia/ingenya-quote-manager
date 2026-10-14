import { describe, expect, it } from 'vitest';
import { getOpportunityValidationError, isOpportunity } from './opportunityValidation';

const input = {
  clientId: 'client',
  name: 'Reforma',
  address: '',
  estimatedStartDate: '',
  responsibleSeller: '',
};
describe('opportunity validation', () => {
  it('requires only client and name, allowing no assigned seller or date', () => {
    expect(getOpportunityValidationError(input)).toBeNull();
    expect(getOpportunityValidationError({ ...input, clientId: '' })).not.toBeNull();
    expect(getOpportunityValidationError({ ...input, name: ' ' })).not.toBeNull();
  });
  it.each(['2026-02-30', '2026-13-01', '14/10/2026', 'invalid'])(
    'rejects invalid date %s',
    (estimatedStartDate) => {
      expect(getOpportunityValidationError({ ...input, estimatedStartDate })).not.toBeNull();
    },
  );
  it('accepts valid calendar dates including leap days', () => {
    expect(
      getOpportunityValidationError({ ...input, estimatedStartDate: '2028-02-29' }),
    ).toBeNull();
  });
  it('validates the complete next action while keeping historical opportunities compatible', () => {
    expect(
      getOpportunityValidationError({
        ...input,
        nextAction: {
          description: 'Llamar para confirmar visita',
          dueDate: '2026-10-20',
          responsible: 'Daniel',
          status: 'pending',
        },
      }),
    ).toBeNull();
    expect(
      getOpportunityValidationError({
        ...input,
        nextAction: { description: '', dueDate: '', responsible: '', status: 'pending' },
      }),
    ).not.toBeNull();
  });
  it('rejects malformed stored records without throwing', () => {
    expect(isOpportunity(null)).toBe(false);
    expect(isOpportunity({ ...input, estimatedStartDate: 123 })).toBe(false);
    expect(
      isOpportunity({ ...input, id: 'opportunity', createdAt: 'invalid', updatedAt: 'invalid' }),
    ).toBe(false);
  });
});
