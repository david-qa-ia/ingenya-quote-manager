import type {
  CommercialReasonCode,
  CommercialOutcome,
  CommercialOutcomeType,
} from '../types/commercialOutcome';
import type { Opportunity, OpportunityCommercialState } from '../types/opportunity';

export const commercialReasonLabels = {
  price: 'Precio',
  noResponse: 'No respondió',
  choseAnotherProposal: 'Eligió a otro',
  outOfScope: 'Fuera de alcance',
  noBudget: 'Sin presupuesto',
  timeline: 'Plazo',
  postponed: 'Lo pospuso',
  invalidData: 'Datos inválidos',
  notInterested: 'No interesado',
  duplicate: 'Duplicado',
  other: 'Otro',
} as const;

/**
 * Why a sale was lost, as offered when marking a quote or a project as lost (product decision:
 * a short list). Other codes stay valid for outcomes saved before.
 */
export const lossReasonCodes = [
  'price',
  'choseAnotherProposal',
  'noResponse',
  'postponed',
  'other',
] as const satisfies readonly CommercialReasonCode[];

export type LossReasonCode = (typeof lossReasonCodes)[number];

export function isLossReasonCode(value: string): value is LossReasonCode {
  return (lossReasonCodes as readonly string[]).includes(value);
}

export type LossReasonField = 'code' | 'detail';

/** A reason must be picked; "Otro" needs a few words saying which. */
export function getLossReasonFieldErrors(draft: {
  code: string;
  detail: string;
}): Partial<Record<LossReasonField, string>> {
  const errors: Partial<Record<LossReasonField, string>> = {};
  if (!isLossReasonCode(draft.code)) errors.code = 'Elegí el motivo de la pérdida.';
  else if (draft.code === 'other' && !draft.detail.trim())
    errors.detail = 'Contá brevemente el motivo.';
  return errors;
}

/** The reason as it is saved in the quote history: "Precio" or "Precio: se fue de presupuesto". */
export function formatLossReason(code: LossReasonCode, detail = ''): string {
  const text = detail.trim();
  return text ? `${commercialReasonLabels[code]}: ${text}` : commercialReasonLabels[code];
}

export const commercialOutcomeLabels: Record<CommercialOutcomeType, string> = {
  accepted: 'Presupuesto aceptado',
  rejected: 'Presupuesto rechazado',
  lost: 'Proyecto perdido',
  reopened: 'Proyecto reabierto',
  corrected: 'Resultado corregido',
};

export function isCommercialOutcome(value: unknown): value is CommercialOutcome {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const validTypes = Object.keys(commercialOutcomeLabels);
  const validReasons = Object.keys(commercialReasonLabels);
  return (
    typeof item.id === 'string' &&
    item.id.trim().length > 0 &&
    typeof item.type === 'string' &&
    validTypes.includes(item.type) &&
    (item.reasonCode === undefined ||
      (typeof item.reasonCode === 'string' && validReasons.includes(item.reasonCode))) &&
    (item.note === undefined || typeof item.note === 'string') &&
    typeof item.occurredAt === 'string' &&
    Number.isFinite(Date.parse(item.occurredAt)) &&
    typeof item.author === 'string' &&
    item.author.trim().length > 0 &&
    (item.origin === 'manual' || item.origin === 'commercialPanel') &&
    typeof item.opportunityId === 'string' &&
    item.opportunityId.trim().length > 0 &&
    (item.quoteId === undefined ||
      (typeof item.quoteId === 'string' && item.quoteId.trim().length > 0)) &&
    (item.supersedesOutcomeId === undefined ||
      (typeof item.supersedesOutcomeId === 'string' &&
        item.supersedesOutcomeId.trim().length > 0)) &&
    !(item.reasonCode === 'other' && (!item.note || !String(item.note).trim()))
  );
}

export function getOpportunityCommercialState(
  outcome: CommercialOutcome,
): OpportunityCommercialState {
  if (outcome.type === 'lost') return 'lost';
  if (outcome.type === 'accepted') return 'won';
  return 'open';
}

export function applyCommercialOutcome(
  opportunity: Opportunity,
  outcome: CommercialOutcome,
): Opportunity {
  if (outcome.opportunityId !== opportunity.id)
    throw new Error('El resultado no pertenece al proyecto.');
  const closesAsWon = outcome.type === 'accepted';
  const closesAsLost = outcome.type === 'lost';
  return {
    ...opportunity,
    commercialState: getOpportunityCommercialState(outcome),
    ...(closesAsWon
      ? { pipelineStage: 'won' as const, status: 'closed' as const }
      : closesAsLost
        ? { pipelineStage: 'lost' as const, status: 'closed' as const }
        : {}),
    currentCommercialOutcomeId: outcome.id,
    updatedAt: outcome.occurredAt,
  };
}
