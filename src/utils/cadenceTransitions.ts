import type {
  CadenceEvent,
  CadenceExecution,
  CadenceStepExecution,
  CadenceTarget,
  CadenceTemplate,
} from '../types/cadence';
import type { NextAction } from '../types/opportunity';

const event = (
  id: string,
  type: CadenceEvent['type'],
  now: string,
  actor: string,
  reason: string,
): CadenceEvent => ({ id, type, occurredAt: now, actor: actor.trim(), reason: reason.trim() });
const dueAt = (now: string, amount: number, unit: 'hours' | 'days') =>
  new Date(Date.parse(now) + amount * (unit === 'hours' ? 3600000 : 86400000)).toISOString();
function firstActive(template: CadenceTemplate) {
  return template.steps
    .filter((step) => step.status === 'active')
    .sort((a, b) => a.order - b.order)[0];
}
function toStep(
  step: CadenceTemplate['steps'][number],
  executionId: string,
  now: string,
): CadenceStepExecution {
  const id = `${executionId}:step:${step.id}`;
  const scheduledAt = dueAt(now, step.waitAmount, step.waitUnit);
  const action: NextAction = {
    id: `${id}:action`,
    type: step.channel,
    description: step.description,
    dueAt: scheduledAt,
    responsible: step.responsible,
    priority: 'medium',
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    cadenceOrigin: {
      cadenceExecutionId: executionId,
      stepExecutionId: id,
      templateStepId: step.id,
    },
    history: [
      {
        id: `${id}:created`,
        occurredAt: now,
        actor: step.responsible,
        event: 'created',
        reason: step.description,
      },
    ],
  };
  return {
    id,
    templateStepId: step.id,
    order: step.order,
    channel: step.channel,
    description: step.description,
    responsible: step.responsible,
    scheduledAt,
    status: 'pending',
    nextAction: action,
    history: [event(`${id}:started`, 'started', now, step.responsible, 'Paso iniciado.')],
  };
}
export function startCadence(
  template: CadenceTemplate,
  target: CadenceTarget,
  actor: string,
  now: string,
  existing: readonly CadenceExecution[],
): CadenceExecution {
  if (template.status !== 'active') throw new Error('La plantilla está pausada.');
  if (!actor.trim()) throw new Error('Ingresá quién inicia la cadencia.');
  if (
    existing.some(
      (item) => item.status === 'active' && JSON.stringify(item.target) === JSON.stringify(target),
    )
  )
    throw new Error('Ya existe una cadencia activa para este objetivo.');
  const step = firstActive(template);
  if (!step) throw new Error('La plantilla no tiene pasos activos.');
  const id = crypto.randomUUID();
  const current = toStep(step, id, now);
  return {
    id,
    templateId: template.id,
    target,
    status: 'active',
    templateSnapshot: structuredClone(template),
    currentStepExecutionId: current.id,
    stepExecutions: [current],
    history: [event(`${id}:started`, 'started', now, actor, 'Cadencia iniciada.')],
    createdAt: now,
    updatedAt: now,
  };
}
function current(execution: CadenceExecution) {
  return execution.stepExecutions.find((item) => item.id === execution.currentStepExecutionId);
}
export function completeCadenceAction(
  execution: CadenceExecution,
  actor: string,
  result: string,
  now: string,
): CadenceExecution {
  const step = current(execution);
  if (execution.status !== 'active' || !step?.nextAction || step.nextAction.status !== 'pending')
    throw new Error('No hay un paso pendiente.');
  if (!actor.trim() || !result.trim()) throw new Error('Ingresá responsable y resultado.');
  const completed = {
    ...step,
    status: 'completed' as const,
    completedAt: now,
    result: result.trim(),
    nextAction: {
      ...step.nextAction,
      status: 'completed' as const,
      updatedAt: now,
      history: [
        ...step.nextAction.history,
        {
          id: `${step.nextAction.id}:completed:${now}`,
          occurredAt: now,
          actor: actor.trim(),
          event: 'completed' as const,
          reason: 'Paso completado.',
          result: result.trim(),
        },
      ],
    },
    history: [
      ...step.history,
      event(`${step.id}:completed:${now}`, 'advanced', now, actor, result),
    ],
  };
  const nextTemplate = execution.templateSnapshot.steps
    .filter((item) => item.status === 'active' && item.order > step.order)
    .sort((a, b) => a.order - b.order)[0];
  if (!nextTemplate)
    return {
      ...execution,
      status: 'completed',
      currentStepExecutionId: undefined,
      stepExecutions: execution.stepExecutions.map((item) =>
        item.id === step.id ? completed : item,
      ),
      history: [
        ...execution.history,
        event(
          `${execution.id}:completed:${now}`,
          'completed',
          now,
          actor,
          'Último paso completado.',
        ),
      ],
      updatedAt: now,
    };
  const next = toStep(nextTemplate, execution.id, now);
  return {
    ...execution,
    currentStepExecutionId: next.id,
    stepExecutions: [
      ...execution.stepExecutions.map((item) => (item.id === step.id ? completed : item)),
      next,
    ],
    history: [
      ...execution.history,
      event(
        `${execution.id}:advanced:${next.id}`,
        'advanced',
        now,
        actor,
        'Avanzó al siguiente paso.',
      ),
    ],
    updatedAt: now,
  };
}
export function updateCadenceAction(
  execution: CadenceExecution,
  eventType: 'rescheduled' | 'cancelled',
  actor: string,
  reason: string,
  now: string,
  nextDueAt?: string,
): CadenceExecution {
  const step = current(execution);
  if (!step?.nextAction || step.nextAction.status !== 'pending' || !actor.trim() || !reason.trim())
    throw new Error('Ingresá responsable y motivo.');
  if (eventType === 'rescheduled' && (!nextDueAt || !Number.isFinite(Date.parse(nextDueAt))))
    throw new Error('Ingresá una fecha y hora válida.');
  const action = {
    ...step.nextAction,
    status: eventType === 'cancelled' ? ('cancelled' as const) : ('pending' as const),
    ...(nextDueAt ? { dueAt: nextDueAt } : {}),
    updatedAt: now,
    history: [
      ...step.nextAction.history,
      {
        id: `${step.nextAction.id}:${eventType}:${now}`,
        occurredAt: now,
        actor: actor.trim(),
        event: eventType,
        reason: reason.trim(),
        ...(nextDueAt ? { previousDueAt: step.nextAction.dueAt } : {}),
      },
    ],
  };
  const replaced = {
    ...step,
    status: eventType === 'cancelled' ? ('cancelled' as const) : step.status,
    nextAction: action,
    history: [
      ...step.history,
      event(
        `${step.id}:${eventType}:${now}`,
        eventType === 'cancelled' ? 'cancelled' : 'rescheduled',
        now,
        actor,
        reason,
      ),
    ],
  };
  return {
    ...execution,
    status: eventType === 'cancelled' ? 'cancelled' : execution.status,
    currentStepExecutionId:
      eventType === 'cancelled' ? undefined : execution.currentStepExecutionId,
    stepExecutions: execution.stepExecutions.map((item) => (item.id === step.id ? replaced : item)),
    history: [
      ...execution.history,
      event(
        `${execution.id}:${eventType}:${now}`,
        eventType === 'cancelled' ? 'cancelled' : 'rescheduled',
        now,
        actor,
        reason,
      ),
    ],
    updatedAt: now,
  };
}
export function setCadencePaused(
  execution: CadenceExecution,
  paused: boolean,
  actor: string,
  reason: string,
  now: string,
): CadenceExecution {
  if (
    !actor.trim() ||
    !reason.trim() ||
    (paused ? execution.status !== 'active' : execution.status !== 'paused')
  )
    throw new Error('La transición de cadencia no está permitida.');
  const type = paused ? 'paused' : 'resumed';
  return {
    ...execution,
    status: paused ? 'paused' : 'active',
    history: [
      ...execution.history,
      event(`${execution.id}:${type}:${now}`, type, now, actor, reason),
    ],
    updatedAt: now,
  };
}
