import { describe, expect, it } from 'vitest';
import type { CadenceTemplate } from '../types/cadence';
import {
  completeCadenceAction,
  setCadencePaused,
  startCadence,
  updateCadenceAction,
} from './cadenceTransitions';

const template: CadenceTemplate = {
  id: 'template',
  name: 'Seguimiento',
  description: '',
  status: 'active',
  createdAt: '2026-10-14T00:00:00.000Z',
  updatedAt: '2026-10-14T00:00:00.000Z',
  steps: [
    {
      id: 'one',
      order: 1,
      channel: 'call',
      description: 'Llamar',
      waitAmount: 1,
      waitUnit: 'hours',
      responsible: 'Daniel',
      status: 'active',
    },
    {
      id: 'two',
      order: 2,
      channel: 'email',
      description: 'Enviar correo',
      waitAmount: 1,
      waitUnit: 'days',
      responsible: 'Daniel',
      status: 'active',
    },
  ],
};
describe('cadence transitions', () => {
  it('blocks paused templates and a second active execution for the same target', () => {
    expect(() =>
      startCadence(
        { ...template, status: 'paused' },
        { kind: 'opportunity', opportunityId: 'opportunity' },
        'Daniel',
        '2026-10-14T00:00:00.000Z',
        [],
      ),
    ).toThrow();
    const execution = startCadence(
      template,
      { kind: 'opportunity', opportunityId: 'opportunity' },
      'Daniel',
      '2026-10-14T00:00:00.000Z',
      [],
    );
    expect(() =>
      startCadence(template, execution.target, 'Daniel', '2026-10-14T00:00:00.000Z', [execution]),
    ).toThrow();
  });
  it('snapshots the template, advances and completes without changing it', () => {
    const execution = startCadence(
      template,
      { kind: 'opportunity', opportunityId: 'opportunity' },
      'Daniel',
      '2026-10-14T00:00:00.000Z',
      [],
    );
    template.steps[1].description = 'Cambiado';
    const advanced = completeCadenceAction(
      execution,
      'Daniel',
      'Contestó',
      '2026-10-14T02:00:00.000Z',
    );
    expect(advanced.stepExecutions.at(-1)?.description).toBe('Enviar correo');
    expect(
      completeCadenceAction(advanced, 'Daniel', 'Finalizado', '2026-10-15T02:00:00.000Z').status,
    ).toBe('completed');
  });
  it('skips paused steps and preserves previous due date on reschedule', () => {
    const execution = startCadence(
      { ...template, steps: [{ ...template.steps[0], status: 'paused' }, template.steps[1]] },
      { kind: 'opportunity', opportunityId: 'opportunity' },
      'Daniel',
      '2026-10-14T00:00:00.000Z',
      [],
    );
    expect(execution.stepExecutions[0].templateStepId).toBe('two');
    const later = updateCadenceAction(
      execution,
      'rescheduled',
      'Daniel',
      'Cliente ocupado',
      '2026-10-14T01:00:00.000Z',
      '2026-10-16T01:00:00.000Z',
    );
    expect(later.stepExecutions[0].nextAction?.history.at(-1)?.previousDueAt).toBe(
      '2026-10-15T00:00:00.000Z',
    );
  });
  it('pauses and cancels an execution', () => {
    const execution = startCadence(
      template,
      { kind: 'sentQuote', quoteId: 'quote' },
      'Daniel',
      '2026-10-14T00:00:00.000Z',
      [],
    );
    expect(
      setCadencePaused(execution, true, 'Daniel', 'Vacaciones', '2026-10-14T01:00:00.000Z').status,
    ).toBe('paused');
    expect(
      updateCadenceAction(execution, 'cancelled', 'Daniel', 'Aceptado', '2026-10-14T01:00:00.000Z')
        .status,
    ).toBe('cancelled');
  });
});
