import { useState } from 'react';
import type { Client, ClientInput } from '../types/client';
import type { Opportunity, OpportunityInput } from '../types/opportunity';
import type { Quote, SavedQuote } from '../types/quote';
import { commercialStatusLabels } from '../utils/quoteCommercialStatus';
import { loadClients, saveClient } from '../utils/clientStorage';
import { loadOpportunities, saveOpportunity } from '../utils/opportunityStorage';
import { isPendingEmail, isPendingPhone } from '../utils/clientValidation';
import { recordAutomaticActivity, recordNextActionActivity } from '../utils/activityStorage';
import { ClientForm } from './ClientForm';
import { OpportunityForm } from './OpportunityForm';
import { NextActionCard } from './NextActionCard';
import { transitionNextAction } from '../utils/opportunityNextAction';

interface Props {
  quote: Quote;
  savedQuotes: readonly SavedQuote[];
  onAssociate: (client: Client | undefined, opportunity: Opportunity | undefined) => void;
  onEntitiesChange: () => void;
}

export function QuoteCommercialContext({
  quote,
  savedQuotes,
  onAssociate,
  onEntitiesChange,
}: Props) {
  const [clientLoad, setClientLoad] = useState(loadClients);
  const [opportunityLoad, setOpportunityLoad] = useState(loadOpportunities);
  const [form, setForm] = useState<
    'newClient' | 'editClient' | 'newOpportunity' | 'editOpportunity' | null
  >(null);
  const [feedback, setFeedback] = useState('');
  const client = clientLoad.items.find((item) => item.id === quote.clientId);
  const opportunity = opportunityLoad.items.find(
    (item) => item.id === quote.opportunityId && item.clientId === client?.id,
  );
  const readOnly = quote.status === 'finalized';
  const availableOpportunities = opportunityLoad.items.filter(
    (item) => item.clientId === client?.id,
  );
  const opportunityQuotes = savedQuotes.filter(
    (savedQuote) =>
      savedQuote.opportunityId === quote.opportunityId && savedQuote.clientId === quote.clientId,
  );

  function refresh() {
    setClientLoad(loadClients());
    setOpportunityLoad(loadOpportunities());
    setForm(null);
    onEntitiesChange();
  }
  function persistClient(input: ClientInput): string | null {
    if (readOnly) return 'El presupuesto finalizado es de solo lectura.';
    const existing = form === 'editClient' ? client : undefined;
    const now = new Date().toISOString();
    const next: Client = {
      ...input,
      id: existing?.id ?? crypto.randomUUID(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    if (!saveClient(next))
      return 'No se pudo guardar el cliente. Los datos existentes se conservaron.';
    if (next.doNotContact) {
      loadOpportunities()
        .items.filter((item) => item.clientId === next.id && item.nextAction?.status === 'pending')
        .forEach((item) => {
          const cancelled = transitionNextAction(
            item,
            'cancelled',
            next.doNotContact!.recordedBy,
            `Pedido de no contacto: ${next.doNotContact!.reason}`,
            next.doNotContact!.recordedAt,
          );
          if (saveOpportunity(cancelled) && cancelled.nextAction)
            recordNextActionActivity(
              cancelled.id,
              cancelled.nextAction.id,
              'cancelled',
              'Recordatorio cancelado por pedido de no contacto.',
            );
        });
    }
    const activitySaved =
      existing ||
      recordAutomaticActivity({ kind: 'client', clientId: next.id }, 'created', 'Cliente creado.');
    refresh();
    if (!existing) onAssociate(next, undefined);
    setFeedback(
      activitySaved
        ? 'Cliente guardado. Los datos de presupuestos anteriores se conservan.'
        : 'Cliente guardado, pero no se pudo registrar su actividad.',
    );
    return null;
  }
  function persistOpportunity(input: OpportunityInput): string | null {
    if (readOnly) return 'El presupuesto finalizado es de solo lectura.';
    const existing = form === 'editOpportunity' ? opportunity : undefined;
    const now = new Date().toISOString();
    const next: Opportunity = {
      ...input,
      id: existing?.id ?? crypto.randomUUID(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    if (!saveOpportunity(next))
      return 'No se pudo guardar la oportunidad. Revisá el cliente y el almacenamiento.';
    const nextActionChanged =
      JSON.stringify(existing?.nextAction) !== JSON.stringify(next.nextAction);
    const activitySaved = !existing
      ? recordAutomaticActivity(
          { kind: 'opportunity', opportunityId: next.id },
          'created',
          'Oportunidad creada.',
        )
      : !nextActionChanged ||
        recordAutomaticActivity(
          { kind: 'opportunity', opportunityId: next.id },
          'nextActionChanged',
          'Próxima acción modificada.',
        );
    refresh();
    if (!existing) onAssociate(client, next);
    setFeedback(
      activitySaved
        ? 'Oportunidad guardada. Los presupuestos anteriores se conservan.'
        : 'Oportunidad guardada, pero no se pudo registrar la actividad.',
    );
    return null;
  }
  function selectClient(id: string) {
    setForm(null);
    setFeedback('');
    onAssociate(
      clientLoad.items.find((item) => item.id === id),
      undefined,
    );
  }
  function persistNextAction(next: Opportunity, event: string): boolean {
    if (readOnly || !saveOpportunity(next)) return false;
    const action = next.nextAction;
    if (
      !action ||
      (event !== 'created' &&
        !recordNextActionActivity(
          next.id,
          action.id,
          event as 'completed' | 'rescheduled' | 'cancelled' | 'notRelevant',
          `Próxima acción ${event === 'completed' ? 'completada' : event === 'rescheduled' ? 'reprogramada' : event === 'cancelled' ? 'cancelada' : 'declarada no relevante'}.`,
        ))
    )
      return false;
    refresh();
    return true;
  }
  return (
    <section className="summary-panel commercial-context" aria-label="Cliente y oportunidad">
      <div className="summary-panel-heading">
        <p className="eyebrow">Contexto actual</p>
        <h2>Cliente y oportunidad</h2>
      </div>
      {(clientLoad.issue || opportunityLoad.issue) && (
        <p className="commercial-warning" role="alert">
          No se pudieron recuperar todos los datos de clientes u oportunidades. Los presupuestos
          conservan su información histórica.
        </p>
      )}
      {((quote.clientId && !client) || (quote.opportunityId && !opportunity)) && (
        <p className="commercial-warning" role="alert">
          Asociación no disponible. Se conservan los datos históricos del presupuesto.
        </p>
      )}
      {!readOnly && (
        <>
          <label className="field">
            <span>Seleccionar cliente</span>
            <select value={quote.clientId ?? ''} onChange={(e) => selectClient(e.target.value)}>
              <option value="">Sin cliente asociado</option>
              {quote.clientId && !client && (
                <option value={quote.clientId}>Cliente no disponible</option>
              )}
              {clientLoad.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.phone} · {item.email} · {item.id.slice(-6)}
                </option>
              ))}
            </select>
          </label>
          <div className="commercial-actions">
            <button
              type="button"
              className="button button-line"
              onClick={() => setForm('newClient')}
            >
              Crear cliente
            </button>
            {client && (
              <button
                type="button"
                className="button button-line"
                onClick={() => setForm('editClient')}
              >
                Editar cliente
              </button>
            )}
            <button type="button" className="button button-line" onClick={() => selectClient('')}>
              Continuar sin cliente
            </button>
          </div>
          {!client && (
            <p className="commercial-note">Podés guardar y finalizar sin cliente asociado.</p>
          )}
          {(form === 'newClient' || form === 'editClient') && (
            <ClientForm
              key={form + (client?.id ?? '')}
              client={form === 'editClient' ? client : undefined}
              onSave={persistClient}
              onCancel={() => setForm(null)}
            />
          )}
        </>
      )}
      {client && (
        <dl className="summary-read-only-data">
          <div>
            <dt>Cliente actual</dt>
            <dd>{client.name}</dd>
          </div>
          <div>
            <dt>Teléfono</dt>
            <dd>
              {client.phone}
              {isPendingPhone(client.phone) && (
                <small className="pending-contact">Pendiente de confirmar</small>
              )}
            </dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>
              {client.email}
              {isPendingEmail(client.email) && (
                <small className="pending-contact">Pendiente de confirmar</small>
              )}
            </dd>
          </div>
        </dl>
      )}
      {!readOnly && client && (
        <>
          <label className="field">
            <span>Seleccionar oportunidad</span>
            <select
              value={quote.opportunityId ?? ''}
              onChange={(e) => {
                setForm(null);
                setFeedback('');
                onAssociate(
                  client,
                  availableOpportunities.find((item) => item.id === e.target.value),
                );
              }}
            >
              <option value="">Sin oportunidad asociada</option>
              {quote.opportunityId && !opportunity && (
                <option value={quote.opportunityId}>Oportunidad no disponible</option>
              )}
              {availableOpportunities.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.id.slice(-6)}
                </option>
              ))}
            </select>
          </label>
          <div className="commercial-actions">
            <button
              type="button"
              className="button button-line"
              onClick={() => setForm('newOpportunity')}
            >
              Crear oportunidad
            </button>
            {opportunity && (
              <button
                type="button"
                className="button button-line"
                onClick={() => setForm('editOpportunity')}
              >
                Editar oportunidad
              </button>
            )}
          </div>
          {(form === 'newOpportunity' || form === 'editOpportunity') && (
            <OpportunityForm
              key={form + client.id}
              clientId={client.id}
              opportunity={form === 'editOpportunity' ? opportunity : undefined}
              onSave={persistOpportunity}
              onCancel={() => setForm(null)}
            />
          )}
        </>
      )}
      <dl className="summary-read-only-data">
        <div>
          <dt>Oportunidad actual</dt>
          <dd>{opportunity?.name || 'Sin oportunidad disponible'}</dd>
        </div>
        <div>
          <dt>Vendedor responsable actual</dt>
          <dd>{opportunity?.responsibleSeller || 'Sin asignar'}</dd>
        </div>
      </dl>
      {opportunity && <NextActionCard opportunity={opportunity} onSave={persistNextAction} />}
      {opportunityQuotes.length > 0 && (
        <div className="opportunity-quotes">
          <h3>Presupuestos asociados</h3>
          <ul>
            {opportunityQuotes.map((savedQuote) => (
              <li key={savedQuote.id}>
                <strong>{savedQuote.id}</strong> ·{' '}
                {savedQuote.status === 'draft' ? 'Borrador' : 'Finalizado'} ·{' '}
                {commercialStatusLabels[savedQuote.commercialStatus]}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!readOnly && (
        <p className="commercial-note">
          Guardá el borrador o finalizalo para conservar la asociación. Editar un cliente u
          oportunidad no cambia los textos del documento.
        </p>
      )}
      {feedback && (
        <p className="commercial-note" role="status">
          {feedback}
        </p>
      )}
    </section>
  );
}
