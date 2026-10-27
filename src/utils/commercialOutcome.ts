import type { CommercialOutcome, CommercialOutcomeType } from '../types/commercialOutcome';
import type { Opportunity, OpportunityCommercialState } from '../types/opportunity';

export const commercialReasonLabels = {
  price: 'Precio',
  noResponse: 'Falta de respuesta',
  choseAnotherProposal: 'Eligió otra propuesta',
  outOfScope: 'Fuera de alcance',
  noBudget: 'Sin presupuesto',
  timeline: 'Plazo',
  invalidData: 'Datos inválidos',
  notInterested: 'No interesado',
  duplicate: 'Duplicado',
  other: 'Otro',
} as const;

export const commercialOutcomeLabels: Record<CommercialOutcomeType, string> = {
  accepted: 'Presupuesto aceptado',
  rejected: 'Presupuesto rechazado',
  lost: 'Obra o trabajo perdida',
  reopened: 'Obra o trabajo reabierta',
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
    throw new Error('El resultado no pertenece a la obra o trabajo.');
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
