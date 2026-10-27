import type { Opportunity } from '../types/opportunity';
import { transitionNextAction } from './opportunityNextAction';

export function closeOpportunityForAcceptedQuote(
  opportunity: Opportunity,
  actor: string,
  occurredAt: string,
): Opportunity {
  const next =
    opportunity.nextAction?.status === 'pending'
      ? transitionNextAction(
          opportunity,
          'cancelled',
          actor,
          'Presupuesto aceptado; la oportunidad fue ganada.',
          occurredAt,
        )
      : opportunity;
  return {
    ...next,
    pipelineStage: 'won',
    commercialState: 'won',
    status: 'closed',
    updatedAt: occurredAt,
  };
}

export function closeOpportunityForRejectedQuote(
  opportunity: Opportunity,
  actor: string,
  occurredAt: string,
): Opportunity {
  const next =
    opportunity.nextAction?.status === 'pending'
      ? transitionNextAction(
          opportunity,
          'cancelled',
          actor,
          'Presupuesto rechazado; la oportunidad fue perdida.',
          occurredAt,
        )
      : opportunity;
  return {
    ...next,
    pipelineStage: 'lost',
    commercialState: 'lost',
    status: 'closed',
    updatedAt: occurredAt,
  };
}
