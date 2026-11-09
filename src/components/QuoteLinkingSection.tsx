import type { Client } from '../types/client';
import type { Opportunity } from '../types/opportunity';
import type { DirectClientInput, DirectQuoteFollowUpInput } from '../utils/directClientQuote';
import { DirectClientQuotePanel } from './DirectClientQuotePanel';

interface Props {
  /** The opportunity and client this quote was started from, when both are known. */
  opportunity?: Opportunity;
  client?: Client;
  onChangeOpportunity: () => void;
  isLinkingOpen: boolean;
  onToggleLinking: () => void;
  clients: readonly Client[];
  opportunities: readonly Opportunity[];
  onSelectOpportunity: (opportunity: Opportunity) => void;
  onDirectChange: (input: DirectClientInput | null, followUp?: DirectQuoteFollowUpInput) => void;
}

/** Top of the quote editor: the linked opportunity, or the optional link to follow-up. */
export function QuoteLinkingSection({
  opportunity,
  client,
  onChangeOpportunity,
  isLinkingOpen,
  onToggleLinking,
  clients,
  opportunities,
  onSelectOpportunity,
  onDirectChange,
}: Props) {
  return opportunity && client ? (
    <section className="quote-card opportunity-quote-context" aria-label="Presupuesto vinculado">
      <div>
        <p className="eyebrow">PRESUPUESTO VINCULADO</p>
        <h2>{opportunity.name}</h2>
        <p>
          Cliente: <strong>{client.name}</strong>
          {client.company ? ` · ${client.company}` : ''}
        </p>
      </div>
      <p className="commercial-note">
        Ya está vinculado a este cliente y oportunidad. No tenés que seleccionar nada más; la
        vinculación se guardará al guardar el borrador o finalizar el presupuesto.
      </p>
      <button type="button" className="button button-line" onClick={onChangeOpportunity}>
        Cambiar oportunidad
      </button>
    </section>
  ) : (
    <section className="quote-card optional-linking-card" aria-label="Vinculación opcional">
      <div className="quote-heading">
        <div>
          <p className="eyebrow">SEGUIMIENTO OPCIONAL</p>
          <h2>¿Querés vincular este presupuesto a seguimiento?</h2>
          <p className="commercial-note">
            Podés continuar sin vincularlo. La vinculación no modifica los servicios, el total ni
            los datos del documento.
          </p>
        </div>
        <button
          className="button button-line"
          type="button"
          aria-expanded={isLinkingOpen}
          onClick={onToggleLinking}
        >
          {isLinkingOpen ? 'Cerrar vinculación' : 'Vincular a seguimiento'}
        </button>
      </div>
      {isLinkingOpen && (
        <DirectClientQuotePanel
          clients={clients}
          opportunities={opportunities}
          onSelectOpportunity={onSelectOpportunity}
          onDirectChange={onDirectChange}
        />
      )}
    </section>
  );
}
