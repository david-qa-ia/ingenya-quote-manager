import type { CadenceExecution, CadenceTemplate } from '../types/cadence';
import { loadCollection, saveCollectionItem } from './localCollectionStorage';
import { updateCadenceAction } from './cadenceTransitions';
import { loadOpportunities, saveOpportunity } from './opportunityStorage';
import { recordCadenceActivity } from './activityStorage';
import { workspaceStorageKey } from './workspaceStorage';

export const CADENCE_TEMPLATES_STORAGE_KEY = 'ingenya.cadenceTemplates.v1';
export const CADENCE_EXECUTIONS_STORAGE_KEY = 'ingenya.cadenceExecutions.v1';

const channels = ['call', 'whatsapp', 'email', 'meeting', 'waitForResponse', 'other'];
const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const isIso = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));
const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
function isStep(value: unknown): boolean {
  if (!isObject(value)) return false;
  return (
    isText(value.id) &&
    Number.isInteger(value.order) &&
    (value.order as number) > 0 &&
    typeof value.channel === 'string' &&
    channels.includes(value.channel) &&
    typeof value.description === 'string' &&
    Number.isInteger(value.waitAmount) &&
    (value.waitAmount as number) > 0 &&
    (value.waitAmount as number) <= 3650 &&
    (value.waitUnit === 'hours' || value.waitUnit === 'days') &&
    isText(value.responsible) &&
    (value.status === 'active' || value.status === 'paused')
  );
}
export function isCadenceTemplate(value: unknown): value is CadenceTemplate {
  if (!isObject(value)) return false;
  const steps = value.steps;
  return (
    isText(value.id) &&
    isText(value.name) &&
    typeof value.description === 'string' &&
    (value.status === 'active' || value.status === 'paused') &&
    Array.isArray(steps) &&
    steps.length > 0 &&
    steps.every(isStep) &&
    new Set(steps.map((step) => (step as CadenceTemplate['steps'][number]).id)).size ===
      steps.length &&
    new Set(steps.map((step) => (step as CadenceTemplate['steps'][number]).order)).size ===
      steps.length &&
    isIso(value.createdAt) &&
    isIso(value.updatedAt)
  );
}
function isEvent(value: unknown): boolean {
  if (!isObject(value)) return false;
  return (
    isText(value.id) &&
    ['started', 'advanced', 'rescheduled', 'paused', 'resumed', 'cancelled', 'completed'].includes(
      String(value.type),
    ) &&
    isIso(value.occurredAt) &&
    isText(value.actor) &&
    typeof value.reason === 'string'
  );
}
function isAction(value: unknown): boolean {
  if (!isObject(value)) return false;
  return (
    isText(value.id) &&
    channels.includes(String(value.type)) &&
    isIso(value.dueAt) &&
    isText(value.responsible) &&
    ['low', 'medium', 'high'].includes(String(value.priority)) &&
    ['pending', 'completed', 'cancelled', 'notRelevant'].includes(String(value.status)) &&
    isIso(value.createdAt) &&
    isIso(value.updatedAt) &&
    Array.isArray(value.history)
  );
}
export function isCadenceExecution(value: unknown): value is CadenceExecution {
  if (
    !isObject(value) ||
    !isCadenceTemplate(value.templateSnapshot) ||
    !Array.isArray(value.stepExecutions) ||
    !Array.isArray(value.history)
  )
    return false;
  const target = value.target;
  if (
    !isObject(target) ||
    !(
      (target.kind === 'opportunity' && isText(target.opportunityId)) ||
      (target.kind === 'sentQuote' && isText(target.quoteId))
    )
  )
    return false;
  return (
    isText(value.id) &&
    isText(value.templateId) &&
    ['active', 'paused', 'cancelled', 'completed'].includes(String(value.status)) &&
    (value.currentStepExecutionId === undefined || isText(value.currentStepExecutionId)) &&
    isIso(value.createdAt) &&
    isIso(value.updatedAt) &&
    value.history.every(isEvent) &&
    value.stepExecutions.every(
      (step) =>
        isObject(step) &&
        isText(step.id) &&
        isText(step.templateStepId) &&
        Number.isInteger(step.order) &&
        channels.includes(String(step.channel)) &&
        typeof step.description === 'string' &&
        isText(step.responsible) &&
        isIso(step.scheduledAt) &&
        ['pending', 'completed', 'skipped', 'cancelled'].includes(String(step.status)) &&
        (step.nextAction === undefined || isAction(step.nextAction)) &&
        (step.completedAt === undefined || isIso(step.completedAt)) &&
        (step.result === undefined || typeof step.result === 'string') &&
        Array.isArray(step.history) &&
        step.history.every(isEvent),
    )
  );
}
export const loadCadenceTemplates = () =>
  loadCollection(CADENCE_TEMPLATES_STORAGE_KEY, isCadenceTemplate);
export const loadCadenceExecutions = () =>
  loadCollection(CADENCE_EXECUTIONS_STORAGE_KEY, isCadenceExecution);
export const saveCadenceTemplate = (template: CadenceTemplate) =>
  saveCollectionItem(CADENCE_TEMPLATES_STORAGE_KEY, structuredClone(template), isCadenceTemplate);
export const saveCadenceExecution = (execution: CadenceExecution) =>
  saveCollectionItem(
    CADENCE_EXECUTIONS_STORAGE_KEY,
    structuredClone(execution),
    isCadenceExecution,
  );
export function removeCadenceTemplate(id: string): boolean {
  try {
    if (loadCadenceExecutions().items.some((execution) => execution.templateId === id))
      return false;
    const loaded = loadCadenceTemplates();
    const template = loaded.items.find((item) => item.id === id);
    if (!template) return false;
    localStorage.setItem(
      workspaceStorageKey(CADENCE_TEMPLATES_STORAGE_KEY),
      JSON.stringify(loaded.items.filter((item) => item.id !== id)),
    );
    return true;
  } catch {
    return false;
  }
}
export function cancelCadencesForCommercialClose(
  quoteId: string,
  opportunityId: string | undefined,
  actor: string,
  reason: string,
  now: string,
): boolean {
  const matching = loadCadenceExecutions().items.filter(
    (item) =>
      (item.status === 'active' || item.status === 'paused') &&
      ((item.target.kind === 'sentQuote' && item.target.quoteId === quoteId) ||
        (opportunityId &&
          item.target.kind === 'opportunity' &&
          item.target.opportunityId === opportunityId)),
  );
  return matching.every((execution) => {
    try {
      const cancelled = updateCadenceAction(execution, 'cancelled', actor, reason, now);
      if (!saveCadenceExecution(cancelled)) return false;
      const subject =
        cancelled.target.kind === 'opportunity'
          ? { kind: 'opportunity' as const, opportunityId: cancelled.target.opportunityId }
          : { kind: 'quote' as const, quoteId: cancelled.target.quoteId };
      if (!recordCadenceActivity(subject, `${cancelled.id}:commercial-close`, reason)) return false;
      if (cancelled.target.kind === 'opportunity') {
        const targetOpportunityId = cancelled.target.opportunityId;
        const opportunity = loadOpportunities().items.find(
          (item) => item.id === targetOpportunityId,
        );
        if (
          opportunity &&
          !saveOpportunity({ ...opportunity, nextAction: undefined, updatedAt: now })
        )
          return false;
      }
      return true;
    } catch {
      return false;
    }
  });
}
