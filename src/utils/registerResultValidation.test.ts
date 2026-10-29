import { describe, expect, it } from 'vitest';
import {
  getFirstInvalidRegisterResultField,
  getRegisterResultFieldErrors,
  type RegisterResultDraft,
} from './registerResultValidation';

const valid: RegisterResultDraft = {
  result: 'effectiveContact',
  nextStep: 'call',
  dueAt: '2026-11-02T10:00',
  actor: 'QA Tester',
  hasPendingAction: false,
};

describe('getRegisterResultFieldErrors', () => {
  it('accepts a complete result', () => {
    expect(getRegisterResultFieldErrors(valid)).toEqual({});
  });

  it('reports a missing responsible on its own field instead of the next-step warning (SCRUM-101)', () => {
    const errors = getRegisterResultFieldErrors({ ...valid, actor: '   ' });
    expect(errors).toEqual({ actor: 'Ingresá el responsable que registra el resultado.' });
  });

  it('reports every missing value at once so the user can fix them together', () => {
    const errors = getRegisterResultFieldErrors({
      ...valid,
      result: '',
      dueAt: '',
      actor: '',
    });
    expect(Object.keys(errors).sort()).toEqual(['actor', 'dueAt', 'result']);
    expect(getFirstInvalidRegisterResultField(errors)).toBe('result');
  });

  it('keeps requiring a next step when the follow-up has no pending action', () => {
    expect(getRegisterResultFieldErrors({ ...valid, nextStep: 'none', dueAt: '' })).toEqual({
      nextStep: 'Elegí un próximo paso: este seguimiento no tiene otra acción pendiente.',
    });
    expect(
      getRegisterResultFieldErrors({
        ...valid,
        nextStep: 'none',
        dueAt: '',
        hasPendingAction: true,
      }),
    ).toEqual({});
  });
});
