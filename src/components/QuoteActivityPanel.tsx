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
    <section
      className="commercial-follow-up-activities"
      aria-labelledby="activities-follow-up-title"
    >
      <div className="summary-panel-heading">
        <h3 id="activities-follow-up-title">Actividades y seguimiento</h3>
      </div>
      <ActivityTimeline
        entrySubject={{ kind: 'quote', quoteId: quote.id }}
        subjects={[
          { subject: { kind: 'quote', quoteId: quote.id }, label: 'Presupuesto' },
          ...(client
            ? [
                {
                  subject: { kind: 'client' as const, clientId: client.id },
                  label: 'Cliente' as const,
                },
              ]
            : []),
          ...(opportunity
            ? [
                {
                  subject: { kind: 'opportunity' as const, opportunityId: opportunity.id },
                  label: 'Obra o trabajo' as const,
                },
              ]
            : []),
        ]}
      />
    </section>
  );
}
