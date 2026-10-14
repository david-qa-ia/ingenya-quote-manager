import type { Opportunity, OpportunityInput } from '../types/opportunity';

function isValidDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}

export function getOpportunityValidationError(input: OpportunityInput): string | null {
  if (!input.clientId.trim()) return 'Seleccioná un cliente para la oportunidad.';
  if (!input.name.trim()) return 'Ingresá el nombre de la oportunidad.';
  if (input.estimatedStartDate && !isValidDate(input.estimatedStartDate)) {
    return 'Ingresá una fecha estimada válida.';
  }
  if (
    input.nextAction &&
    (!input.nextAction.description.trim() ||
      !input.nextAction.responsible.trim() ||
      !isValidDate(input.nextAction.dueDate) ||
      !['pending', 'completed', 'cancelled'].includes(input.nextAction.status))
  ) {
    return 'Ingresá una próxima acción válida.';
  }
  return null;
}

export function normalizeOpportunityInput(input: OpportunityInput): OpportunityInput {
  return {
    clientId: input.clientId.trim(),
    name: input.name.trim(),
    address: input.address.trim(),
    estimatedStartDate: input.estimatedStartDate,
    responsibleSeller: input.responsibleSeller.trim(),
    ...(input.nextAction
      ? {
          nextAction: {
            description: input.nextAction.description.trim(),
            dueDate: input.nextAction.dueDate,
            responsible: input.nextAction.responsible.trim(),
            status: input.nextAction.status,
          },
        }
      : {}),
  };
}

export function isOpportunity(value: unknown): value is Opportunity {
  if (typeof value !== 'object' || value === null) return false;
  const opportunity = value as Record<string, unknown>;
  return (
    [
      'id',
      'clientId',
      'name',
      'address',
      'estimatedStartDate',
      'responsibleSeller',
      'createdAt',
      'updatedAt',
    ].every((key) => typeof opportunity[key] === 'string') &&
    (opportunity.id as string).trim().length > 0 &&
    Number.isFinite(Date.parse(opportunity.createdAt as string)) &&
    Number.isFinite(Date.parse(opportunity.updatedAt as string)) &&
    getOpportunityValidationError(opportunity as unknown as OpportunityInput) === null
  );
}
