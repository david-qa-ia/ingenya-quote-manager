import type { Client } from '../types/client';
import type { Opportunity } from '../types/opportunity';
import type { Quote } from '../types/quote';

export function associateQuote(
  quote: Quote,
  client: Client | undefined,
  opportunity: Opportunity | undefined,
  preserveSnapshots: boolean,
): Quote {
  if (quote.status === 'finalized')
    throw new Error('Un presupuesto finalizado no se puede modificar.');
  if (opportunity && (!client || opportunity.clientId !== client.id)) {
    throw new Error('La oportunidad debe pertenecer al cliente seleccionado.');
  }
  return {
    ...quote,
    clientId: client?.id,
    opportunityId: opportunity?.id,
    clientName: preserveSnapshots ? quote.clientName : (client?.name ?? ''),
    projectName: preserveSnapshots ? quote.projectName : (opportunity?.name ?? ''),
  };
}
