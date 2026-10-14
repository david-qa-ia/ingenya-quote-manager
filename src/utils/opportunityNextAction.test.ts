import { describe, expect, it } from 'vitest';
import type { Opportunity } from '../types/opportunity';
import {
  getActionBucket,
  isOverdue,
  sortOpportunitiesByAction,
  transitionNextAction,
} from './opportunityNextAction';

const action = {
  id: 'action',
  type: 'call' as const,
  description: 'Confirmar visita',
  dueAt: '2026-10-14T12:00:00.000Z',
  responsible: 'Daniel',
  priority: 'high' as const,
  status: 'pending' as const,
  createdAt: '2026-10-14T00:00:00.000Z',
  updatedAt: '2026-10-14T00:00:00.000Z',
  history: [],
};
const opportunity: Opportunity = {
  id: 'opportunity',
  clientId: 'client',
  name: 'Obra',
  address: '',
  estimatedStartDate: '',
  responsibleSeller: '',
  nextAction: action,
  createdAt: action.createdAt,
  updatedAt: action.updatedAt,
};

describe('opportunity next actions', () => {
  it('marks overdue actions from the persisted UTC instant without a scheduler', () => {
    expect(isOverdue(action, new Date('2026-10-14T12:00:01.000Z'))).toBe(true);
    expect(getActionBucket(action, new Date('2026-10-14T11:00:00.000Z'))).toBe('today');
  });
  it('preserves the previous date on rescheduling', () => {
    const next = transitionNextAction(
      opportunity,
      'rescheduled',
      'Daniel',
      'El cliente pidió cambiarla.',
      '2026-10-14T10:00:00.000Z',
      { dueAt: '2026-10-15T12:00:00.000Z' },
    );
    expect(next.nextAction?.dueAt).toBe('2026-10-15T12:00:00.000Z');
    expect(next.nextAction?.history[0]).toMatchObject({
      event: 'rescheduled',
      previousDueAt: action.dueAt,
    });
    expect(opportunity.nextAction?.dueAt).toBe(action.dueAt);
  });
  it('requires result to complete and reason for terminal changes', () => {
    expect(() =>
      transitionNextAction(
        opportunity,
        'completed',
        'Daniel',
        'Realizada',
        '2026-10-14T13:00:00.000Z',
      ),
    ).toThrow();
    expect(() =>
      transitionNextAction(opportunity, 'cancelled', 'Daniel', '', '2026-10-14T13:00:00.000Z'),
    ).toThrow();
  });
  it('sorts overdue, date, priority and name', () => {
    const later = {
      ...opportunity,
      id: 'later',
      name: 'Zeta',
      nextAction: {
        ...action,
        id: 'later',
        dueAt: '2026-10-16T12:00:00.000Z',
        priority: 'low' as const,
      },
    };
    const overdue = {
      ...opportunity,
      id: 'overdue',
      name: 'Alfa',
      nextAction: {
        ...action,
        id: 'overdue',
        dueAt: '2026-10-13T12:00:00.000Z',
        priority: 'low' as const,
      },
    };
    expect(
      sortOpportunitiesByAction(
        [later, overdue, opportunity],
        new Date('2026-10-14T15:00:00.000Z'),
      ).map((item) => item.id),
    ).toEqual(['overdue', 'opportunity', 'later']);
  });
});
