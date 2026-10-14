import type { Quote } from '../types/quote';
import { loadClients } from '../utils/clientStorage';
import { loadOpportunities } from '../utils/opportunityStorage';
import { ActivityTimeline } from './ActivityTimeline';

interface Props {
  quote: Quote;
}

export function QuoteActivityPanel({ quote }: Props) {
  const client = loadClients().items.find((item) => item.id === quote.clientId);
  const opportunity = loadOpportunities().items.find(
    (item) => item.id === quote.opportunityId && item.clientId === client?.id,
  );

  return (
    <div className="sidebar-tab-stack">
      <ActivityTimeline subject={{ kind: 'quote', quoteId: quote.id }} title="Presupuesto" />
      {client && (
        <ActivityTimeline
          subject={{ kind: 'client', clientId: client.id }}
          title="Cliente"
          showAuthor={false}
        />
      )}
      {opportunity && (
        <ActivityTimeline
          subject={{ kind: 'opportunity', opportunityId: opportunity.id }}
          title="Oportunidad"
          showAuthor={false}
        />
      )}
    </div>
  );
}
