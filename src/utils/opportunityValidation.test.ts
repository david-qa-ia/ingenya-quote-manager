import { describe, expect, it } from 'vitest';
import {
  getOpportunityValidationError,
  isOpportunity,
  recoverOpportunity,
} from './opportunityValidation';

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
          id: 'action',
          type: 'call',
          description: 'Llamar para confirmar visita',
          dueAt: '2026-10-20T12:00:00.000Z',
          priority: 'medium',
          createdAt: '2026-10-14T00:00:00.000Z',
          updatedAt: '2026-10-14T00:00:00.000Z',
          history: [],
          responsible: 'Daniel',
          status: 'pending',
        },
      }),
    ).toBeNull();
    expect(
      getOpportunityValidationError({
        ...input,
        nextAction: {
          id: '',
          type: 'call',
          description: '',
          dueAt: '',
          responsible: '',
          priority: 'medium',
          status: 'pending',
          createdAt: '',
          updatedAt: '',
          history: [],
        },
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
  it('migrates the SCRUM-48 action at 09:00 Argentina without writing it', () => {
    const legacy = {
      ...input,
      id: 'opportunity',
      createdAt: '2026-10-14T00:00:00.000Z',
      updatedAt: '2026-10-14T00:00:00.000Z',
      nextAction: {
        description: 'Llamar',
        dueDate: '2026-10-20',
        responsible: 'Daniel',
        status: 'pending',
      },
    };
    const migrated = recoverOpportunity(legacy);
    expect(migrated?.nextAction).toMatchObject({
      id: 'legacy-next-action:opportunity',
      dueAt: '2026-10-20T12:00:00.000Z',
      priority: 'medium',
    });
    expect(recoverOpportunity(legacy)).toEqual(migrated);
  });
});
