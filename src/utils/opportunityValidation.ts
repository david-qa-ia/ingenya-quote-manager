import type {
  NextAction,
  NextActionHistoryEntry,
  NoNextActionException,
  OpportunityQualification,
  Opportunity,
  OpportunityInput,
} from '../types/opportunity';

const actionTypes = ['call', 'whatsapp', 'email', 'meeting', 'waitForResponse', 'other'];
const actionKinds = ['followUp', 'sendQuote', 'other'];
const actionStatuses = ['pending', 'completed', 'cancelled', 'notRelevant'];
const actionPriorities = ['low', 'medium', 'high'];
const historyEvents = ['created', 'rescheduled', 'completed', 'cancelled', 'notRelevant'];
const pipelineStages = [
  'prospect',
  'contacted',
  'qualified',
  'opportunity',
  'proposal',
  'won',
  'lost',
];

function isValidDate(value: string): boolean {
  const instant = new Date(`${value}T12:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(instant.getTime()) &&
    instant.toISOString().slice(0, 10) === value
  );
}
function isIso(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
function isHistory(value: unknown): value is NextActionHistoryEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  return (
    isNonEmpty(entry.id) &&
    isIso(entry.occurredAt) &&
    isNonEmpty(entry.actor) &&
    typeof entry.event === 'string' &&
    historyEvents.includes(entry.event) &&
    typeof entry.reason === 'string' &&
    (entry.previousDueAt === undefined || isIso(entry.previousDueAt)) &&
    (entry.result === undefined || typeof entry.result === 'string')
  );
}
function isCadenceOrigin(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const origin = value as Record<string, unknown>;
  return (
    isNonEmpty(origin.cadenceExecutionId) &&
    isNonEmpty(origin.stepExecutionId) &&
    isNonEmpty(origin.templateStepId)
  );
}
export function isNextAction(value: unknown): value is NextAction {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const action = value as Record<string, unknown>;
  return (
    isNonEmpty(action.id) &&
    (action.kind === undefined ||
      (typeof action.kind === 'string' && actionKinds.includes(action.kind))) &&
    typeof action.type === 'string' &&
    actionTypes.includes(action.type) &&
    typeof action.description === 'string' &&
    isIso(action.dueAt) &&
    isNonEmpty(action.responsible) &&
    typeof action.priority === 'string' &&
    actionPriorities.includes(action.priority) &&
    (action.suggestedChannel === undefined ||
      (typeof action.suggestedChannel === 'string' &&
        actionTypes.includes(action.suggestedChannel))) &&
    typeof action.status === 'string' &&
    actionStatuses.includes(action.status) &&
    isIso(action.createdAt) &&
    isIso(action.updatedAt) &&
    (action.cadenceOrigin === undefined || isCadenceOrigin(action.cadenceOrigin)) &&
    Array.isArray(action.history) &&
    action.history.every(isHistory)
  );
}
function isException(value: unknown): value is NoNextActionException {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const exception = value as Record<string, unknown>;
  return (
    isNonEmpty(exception.reason) && isIso(exception.recordedAt) && isNonEmpty(exception.recordedBy)
  );
}
function isQualification(value: unknown): value is OpportunityQualification {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const qualification = value as Record<string, unknown>;
  return (
    isNonEmpty(qualification.serviceOfInterest) &&
    typeof qualification.interestLevel === 'string' &&
    ['high', 'medium', 'low'].includes(qualification.interestLevel) &&
    isNonEmpty(qualification.detectedNeed) &&
    (qualification.estimatedValue === undefined ||
      (typeof qualification.estimatedValue === 'number' &&
        Number.isFinite(qualification.estimatedValue) &&
        qualification.estimatedValue >= 0))
  );
}

function migrateLegacyNextAction(
  value: Record<string, unknown>,
  opportunityId: string,
): NextAction | undefined {
  const legacy = value.nextAction as Record<string, unknown> | undefined;
  if (!legacy || typeof legacy !== 'object' || isNextAction(legacy)) return undefined;
  if (
    !isNonEmpty(legacy.description) ||
    !isNonEmpty(legacy.responsible) ||
    !isValidDate(String(legacy.dueDate))
  )
    return undefined;
  if (!['pending', 'completed', 'cancelled'].includes(String(legacy.status))) return undefined;
  const createdAt = isIso(value.updatedAt) ? value.updatedAt : new Date(0).toISOString();
  return {
    id: `legacy-next-action:${opportunityId}`,
    type: 'other',
    description: legacy.description.trim(),
    dueAt: `${legacy.dueDate}T12:00:00.000Z`,
    responsible: legacy.responsible.trim(),
    priority: 'medium',
    status: legacy.status as NextAction['status'],
    createdAt,
    updatedAt: createdAt,
    history: [
      {
        id: `legacy-next-action-created:${opportunityId}`,
        occurredAt: createdAt,
        actor: 'Migración local',
        event: 'created',
        reason: 'Acción migrada desde SCRUM-48.',
      },
    ],
  };
}

export function recoverOpportunity(value: unknown): Opportunity | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    ![
      'id',
      'clientId',
      'name',
      'address',
      'estimatedStartDate',
      'responsibleSeller',
      'createdAt',
      'updatedAt',
    ].every((key) => typeof record[key] === 'string')
  )
    return null;
  if (
    !isNonEmpty(record.id) ||
    !isIso(record.createdAt) ||
    !isIso(record.updatedAt) ||
    (record.estimatedStartDate && !isValidDate(record.estimatedStartDate as string))
  )
    return null;
  const migratedAction = migrateLegacyNextAction(record, record.id as string);
  const nextAction = isNextAction(record.nextAction) ? record.nextAction : migratedAction;
  const noNextActionException = isException(record.noNextActionException)
    ? record.noNextActionException
    : undefined;
  if (record.nextAction !== undefined && !nextAction) return null;
  if (record.qualification !== undefined && !isQualification(record.qualification)) return null;
  if (nextAction?.status === 'pending' && noNextActionException) return null;
  if (
    record.status !== undefined &&
    !['active', 'cancelled', 'converted', 'closed'].includes(record.status as string)
  )
    return null;
  return {
    id: record.id as string,
    clientId: record.clientId as string,
    name: record.name as string,
    address: record.address as string,
    estimatedStartDate: record.estimatedStartDate as string,
    responsibleSeller: record.responsibleSeller as string,
    status: (record.status as Opportunity['status']) ?? 'active',
    commercialState:
      record.commercialState === 'open' ||
      record.commercialState === 'won' ||
      record.commercialState === 'lost'
        ? record.commercialState
        : 'open',
    pipelineStage: pipelineStages.includes(record.pipelineStage as string)
      ? (record.pipelineStage as Opportunity['pipelineStage'])
      : record.commercialState === 'won'
        ? 'won'
        : record.commercialState === 'lost'
          ? 'lost'
          : 'opportunity',
    ...(isNonEmpty(record.currentCommercialOutcomeId)
      ? { currentCommercialOutcomeId: record.currentCommercialOutcomeId }
      : {}),
    ...(isNonEmpty(record.origin) ? { origin: record.origin } : {}),
    ...(isQualification(record.qualification) ? { qualification: record.qualification } : {}),
    ...(nextAction ? { nextAction } : {}),
    ...(noNextActionException ? { noNextActionException } : {}),
    createdAt: record.createdAt as string,
    updatedAt: record.updatedAt as string,
  };
}

export function getOpportunityValidationError(input: OpportunityInput): string | null {
  if (!input.clientId.trim()) return 'Seleccioná un contacto para la obra o trabajo.';
  if (!input.name.trim()) return 'Ingresá el nombre de la obra o trabajo.';
  if (input.estimatedStartDate && !isValidDate(input.estimatedStartDate))
    return 'Ingresá una fecha estimada válida.';
  if (input.nextAction && !isNextAction(input.nextAction))
    return 'Ingresá una próxima acción válida.';
  if (input.noNextActionException && !isException(input.noNextActionException))
    return 'Ingresá una excepción válida.';
  if (input.nextAction?.status === 'pending' && input.noNextActionException)
    return 'No puede haber una acción pendiente y una excepción a la vez.';
  if (input.qualification && !isQualification(input.qualification))
    return 'Ingresá una calificación de oportunidad válida.';
  return null;
}

export type OpportunityFormField = 'name' | 'estimatedStartDate';

/** Display order of the editable opportunity fields, used to focus the first invalid one. */
export const opportunityFormFieldOrder: readonly OpportunityFormField[] = [
  'name',
  'estimatedStartDate',
];

/**
 * Field-level messages for the fields edited in the opportunity form (SCRUM-107). Same rules and
 * messages as getOpportunityValidationError, which still guards the rest of the record.
 */
export function getOpportunityFormFieldErrors(
  input: OpportunityInput,
): Partial<Record<OpportunityFormField, string>> {
  const errors: Partial<Record<OpportunityFormField, string>> = {};
  if (!input.name.trim()) errors.name = 'Ingresá el nombre de la obra o trabajo.';
  if (input.estimatedStartDate && !isValidDate(input.estimatedStartDate))
    errors.estimatedStartDate = 'Ingresá una fecha estimada válida.';
  return errors;
}

export function normalizeOpportunityInput(input: OpportunityInput): OpportunityInput {
  return {
    clientId: input.clientId.trim(),
    name: input.name.trim(),
    address: input.address.trim(),
    estimatedStartDate: input.estimatedStartDate,
    responsibleSeller: input.responsibleSeller.trim(),
    commercialState: input.commercialState ?? 'open',
    pipelineStage: input.pipelineStage ?? 'opportunity',
    ...(input.origin?.trim() ? { origin: input.origin.trim() } : {}),
    ...(input.qualification
      ? {
          qualification: {
            ...input.qualification,
            serviceOfInterest: input.qualification.serviceOfInterest.trim(),
            detectedNeed: input.qualification.detectedNeed.trim(),
          },
        }
      : {}),
    ...(input.currentCommercialOutcomeId
      ? { currentCommercialOutcomeId: input.currentCommercialOutcomeId }
      : {}),
    ...(input.nextAction ? { nextAction: structuredClone(input.nextAction) } : {}),
    ...(input.noNextActionException
      ? {
          noNextActionException: {
            ...input.noNextActionException,
            reason: input.noNextActionException.reason.trim(),
            recordedBy: input.noNextActionException.recordedBy.trim(),
          },
        }
      : {}),
  };
}
export function isOpportunity(value: unknown): value is Opportunity {
  return recoverOpportunity(value) !== null;
}
