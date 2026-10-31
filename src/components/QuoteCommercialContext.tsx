import { useState } from 'react';
import type { Client, ClientInput } from '../types/client';
import type { Opportunity, OpportunityInput } from '../types/opportunity';
import type { Quote, SavedQuote } from '../types/quote';
import type { CommercialOutcome } from '../types/commercialOutcome';
import { loadClients } from '../utils/clientStorage';
import { persistContact } from '../utils/contactPersistence';
import { loadOpportunities, saveOpportunity } from '../utils/opportunityStorage';
import { isPendingEmail, isPendingPhone } from '../utils/clientValidation';
import {
  recordAutomaticActivity,
  recordCommercialOutcomeActivity,
  recordNextActionActivity,
} from '../utils/activityStorage';
import { ClientForm } from './ClientForm';
import { OpportunityForm } from './OpportunityForm';
import { NextActionCard } from './NextActionCard';
import { ContactAssistant } from './ContactAssistant';
import { transitionNextAction } from '../utils/opportunityNextAction';
import {
  cancelCadencesForCommercialClose,
  loadCadenceExecutions,
  saveCadenceExecution,
} from '../utils/cadenceStorage';
import { completeCadenceAction, updateCadenceAction } from '../utils/cadenceTransitions';
import { appendCommercialOutcome } from '../utils/commercialOutcomeStorage';
import { applyCommercialOutcome, commercialOutcomeLabels } from '../utils/commercialOutcome';
import { CommercialOutcomePanel } from './CommercialOutcomePanel';

interface Props {
  quote: Quote;
  savedQuotes: readonly SavedQuote[];
  onAssociate: (client: Client | undefined, opportunity: Opportunity | undefined) => void;
  onEntitiesChange: () => void;
  onQuoteResult: (
    status: 'accepted' | 'rejected',
    audit: Quote['commercialStatusAudit'],
  ) => string | null;
}

function getAllowedChannelLabel(client: Client | undefined): string {
  if (!client) return 'Sin contacto vinculado';
  if (client.doNotContact) return 'No permitido: pedido de no contacto';
  if (!client.contactConsent) return 'No permitido: falta consentimiento';
  if (isPendingPhone(client.phone)) return 'No permitido: teléfono pendiente de confirmar';
  const preferred =
    client.preferredChannel === 'phone'
      ? 'Llamada'
      : client.preferredChannel === 'whatsapp'
        ? 'WhatsApp'
        : client.preferredChannel === 'email'
          ? 'Email'
          : 'Sin preferencia registrada';
  return `Llamada y WhatsApp permitidas · preferencia: ${preferred}`;
}

export function QuoteCommercialContext({
  quote,
  savedQuotes,
  onAssociate,
  onEntitiesChange,
  onQuoteResult,
}: Props) {
  const [clientLoad, setClientLoad] = useState(loadClients);
  const [opportunityLoad, setOpportunityLoad] = useState(loadOpportunities);
  const [form, setForm] = useState<
    'newClient' | 'editClient' | 'newOpportunity' | 'editOpportunity' | null
  >(null);
  const [feedback, setFeedback] = useState('');
  const [contactChannel, setContactChannel] = useState<'call' | 'whatsapp' | null>(null);
  const [isContactManagementOpen, setIsContactManagementOpen] = useState(false);
  const [isWorkManagementOpen, setIsWorkManagementOpen] = useState(false);
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
  const canPrepareContact = Boolean(
    client && !client.doNotContact && client.contactConsent && !isPendingPhone(client.phone),
  );
  const defaultContactChannel = client?.preferredChannel === 'whatsapp' ? 'whatsapp' : 'call';

  function openContactManagement(nextForm: 'newClient' | 'editClient' | null = null) {
    setIsContactManagementOpen(true);
    setForm(nextForm);
  }

  function openWorkManagement(nextForm: 'newOpportunity' | 'editOpportunity' | null = null) {
    setIsWorkManagementOpen(true);
    setForm(nextForm);
  }

  function refresh() {
    setClientLoad(loadClients());
    setOpportunityLoad(loadOpportunities());
    setForm(null);
    onEntitiesChange();
  }
  async function persistClient(input: ClientInput): Promise<string | null> {
    if (readOnly) return 'El presupuesto finalizado es de solo lectura.';
    const existing = form === 'editClient' ? client : undefined;
    const now = new Date().toISOString();
    const next: Client = {
      ...input,
      id: existing?.id ?? crypto.randomUUID(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      ...(existing?.version !== undefined ? { version: existing.version } : {}),
    };
    const persisted = await persistContact(next, !existing);
    if (!persisted.ok) return persisted.error;
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
      return 'No se pudo guardar la obra o trabajo. Revisá el contacto y el almacenamiento.';
    const nextActionChanged =
      JSON.stringify(existing?.nextAction) !== JSON.stringify(next.nextAction);
    const activitySaved = !existing
      ? recordAutomaticActivity(
          { kind: 'opportunity', opportunityId: next.id },
          'created',
          'Obra o trabajo creado.',
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
        ? 'Obra o trabajo guardado. Los presupuestos anteriores se conservan.'
        : 'Obra o trabajo guardado, pero no se pudo registrar la actividad.',
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
    if (readOnly) return false;
    const origin = next.nextAction?.cadenceOrigin;
    if (origin && (event === 'completed' || event === 'reschedule' || event === 'cancel')) {
      const execution = loadCadenceExecutions().items.find(
        (item) => item.id === origin.cadenceExecutionId,
      );
      if (!execution) return false;
      try {
        const now = new Date().toISOString();
        const updated =
          event === 'completed'
            ? completeCadenceAction(
                execution,
                next.nextAction!.history.at(-1)?.actor ?? 'Sistema local',
                next.nextAction!.history.at(-1)?.result ?? '',
                now,
              )
            : updateCadenceAction(
                execution,
                event === 'cancel' ? 'cancelled' : 'rescheduled',
                next.nextAction!.history.at(-1)?.actor ?? 'Sistema local',
                next.nextAction!.history.at(-1)?.reason ?? '',
                now,
                event === 'reschedule' ? next.nextAction?.dueAt : undefined,
              );
        const current = updated.stepExecutions.find(
          (item) => item.id === updated.currentStepExecutionId,
        );
        const opportunityWithCadence = { ...next, nextAction: current?.nextAction, updatedAt: now };
        if (!saveCadenceExecution(updated) || !saveOpportunity(opportunityWithCadence))
          return false;
      } catch {
        return false;
      }
    } else if (!saveOpportunity(next)) return false;
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
  function recordCommercialOutcome(outcome: CommercialOutcome, closeAsWon: boolean): string | null {
    if (!opportunity) return 'Vinculá una obra o trabajo antes de registrar el resultado.';
    if (!appendCommercialOutcome(outcome))
      return 'No se pudo guardar el resultado. No se modificó la obra o trabajo.';
    const reason = outcome.note?.trim() || commercialOutcomeLabels[outcome.type];
    if (outcome.type === 'accepted' || outcome.type === 'rejected') {
      const quoteError = onQuoteResult(outcome.type, {
        changedAt: outcome.occurredAt,
        changedBy: outcome.author,
        reason,
      });
      if (quoteError) return `El resultado se conservó, pero ${quoteError}`;
    }
    let next =
      outcome.type === 'lost' ||
      outcome.type === 'reopened' ||
      (outcome.type === 'accepted' && closeAsWon)
        ? applyCommercialOutcome(opportunity, outcome)
        : {
            ...opportunity,
            currentCommercialOutcomeId: outcome.id,
            updatedAt: outcome.occurredAt,
          };
    if (
      (outcome.type === 'lost' || (outcome.type === 'accepted' && closeAsWon)) &&
      next.nextAction?.status === 'pending'
    ) {
      next = transitionNextAction(next, 'cancelled', outcome.author, reason, outcome.occurredAt);
      if (
        !recordNextActionActivity(
          next.id,
          next.nextAction!.id,
          'cancelled',
          'Acción cancelada por cierre comercial.',
        )
      )
        return 'El resultado se conservó, pero no se pudo registrar la cancelación de la acción.';
    }
    if (!saveOpportunity(next))
      return 'El resultado se conservó, pero no se pudo actualizar la obra o trabajo.';
    if (outcome.type === 'lost' || (outcome.type === 'accepted' && closeAsWon)) {
      const quoteIds =
        outcome.type === 'lost' ? opportunityQuotes.map((item) => item.id) : [quote.id];
      if (
        !quoteIds.every((id) =>
          cancelCadencesForCommercialClose(
            id,
            opportunity.id,
            outcome.author,
            reason,
            outcome.occurredAt,
          ),
        )
      )
        return 'El resultado se conservó, pero no se pudieron cancelar todas las cadencias.';
    }
    if (
      !recordCommercialOutcomeActivity(
        opportunity.id,
        outcome.id,
        commercialOutcomeLabels[outcome.type],
      )
    )
      return 'El resultado se guardó, pero no se pudo registrar su actividad.';
    refresh();
    return null;
  }
  return (
    <>
      {opportunity && (
        <NextActionCard
          opportunity={opportunity}
          onSave={persistNextAction}
          onPrepareContact={setContactChannel}
        />
      )}
      <section
        className="summary-panel commercial-context"
        aria-label="Ficha de contacto y obra en seguimiento"
      >
        <div className="summary-panel-heading">
          <p className="eyebrow">Seguimiento comercial</p>
          <h2>Ficha de contacto y obra en seguimiento</h2>
        </div>
        <p className="commercial-note">
          Datos para gestionar el seguimiento. No cambian el nombre ni la obra del presupuesto/PDF.
        </p>
        {(clientLoad.issue || opportunityLoad.issue) && (
          <p className="commercial-warning" role="alert">
            No se pudieron recuperar todos los datos de contactos u obras o trabajos. Los
            presupuestos conservan su información histórica.
          </p>
        )}
        {((quote.clientId && !client) || (quote.opportunityId && !opportunity)) && (
          <p className="commercial-warning" role="alert">
            Asociación no disponible. Se conservan los datos históricos del presupuesto.
          </p>
        )}
        {client ? (
          <div className="commercial-context-grid">
            <section className="commercial-context-column" aria-labelledby="contact-title">
              <div className="commercial-context-column-heading">
                <h3 id="contact-title">Contacto</h3>
                {!readOnly && (
                  <button
                    className="button button-link compact-context-action"
                    type="button"
                    onClick={() => openContactManagement('editClient')}
                  >
                    Editar
                  </button>
                )}
              </div>
              <strong className="context-name">{client.name}</strong>
              <p className="context-contact-details">
                <span>
                  {client.phone}
                  {isPendingPhone(client.phone) && ' · Pendiente de confirmar'}
                </span>
                <span>
                  {client.email}
                  {isPendingEmail(client.email) && ' · Pendiente de confirmar'}
                </span>
              </p>
              <span
                className={`contact-permission ${canPrepareContact ? 'contact-permission-allowed' : ''}`}
              >
                {canPrepareContact
                  ? defaultContactChannel === 'whatsapp'
                    ? 'WhatsApp permitido'
                    : 'Llamada permitida'
                  : getAllowedChannelLabel(client)}
              </span>
              <div className="context-actions">
                {canPrepareContact && (
                  <button
                    className="button button-primary"
                    type="button"
                    onClick={() => setContactChannel(defaultContactChannel)}
                  >
                    Preparar contacto
                  </button>
                )}
                <button
                  className="button button-line"
                  type="button"
                  onClick={() => openContactManagement()}
                >
                  Ver ficha
                </button>
              </div>
            </section>
            <section className="commercial-context-column" aria-labelledby="opportunity-title">
              <div className="commercial-context-column-heading">
                <h3 id="opportunity-title">Obra o trabajo en seguimiento</h3>
                {!readOnly && opportunity && (
                  <button
                    className="button button-link compact-context-action"
                    type="button"
                    onClick={() => openWorkManagement('editOpportunity')}
                  >
                    Editar
                  </button>
                )}
              </div>
              <strong className="context-name">
                {opportunity?.name || 'Este presupuesto no está vinculado a una obra'}
              </strong>
              <dl className="context-key-data">
                <div>
                  <dt>Responsable</dt>
                  <dd>{opportunity?.responsibleSeller || 'Sin asignar'}</dd>
                </div>
                <div>
                  <dt>Próximo paso</dt>
                  <dd>{opportunity?.nextAction?.description || 'Sin próximo paso'}</dd>
                </div>
                {opportunity && (
                  <div>
                    <dt>Presupuestos vinculados</dt>
                    <dd>
                      {opportunityQuotes.length}{' '}
                      {opportunityQuotes.length === 1 ? 'presupuesto' : 'presupuestos'}
                    </dd>
                  </div>
                )}
              </dl>
              {!opportunity && (
                <>
                  <p className="commercial-note">
                    No hace falta crear una para continuar. Vinculala únicamente si querés agrupar
                    presupuestos y registrar seguimiento de un mismo trabajo.
                  </p>
                  {!readOnly && (
                    <div className="context-actions">
                      <button
                        className="button button-primary"
                        type="button"
                        onClick={() => openWorkManagement()}
                      >
                        Vincular obra o trabajo
                      </button>
                      <button
                        className="button button-line"
                        type="button"
                        onClick={() => openWorkManagement('newOpportunity')}
                      >
                        Crear obra o trabajo
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        ) : (
          <section className="commercial-context-empty" aria-labelledby="contact-title">
            <h3 id="contact-title">Todavía no hay un contacto vinculado.</h3>
            <p className="commercial-note">
              El presupuesto puede continuar sin contacto. Vincularlo habilita comunicaciones y
              seguimiento.
            </p>
            {!readOnly && (
              <div className="context-actions">
                <button
                  className="button button-primary"
                  type="button"
                  onClick={() => openContactManagement()}
                >
                  Vincular contacto
                </button>
                <button
                  className="button button-line"
                  type="button"
                  onClick={() => openContactManagement('newClient')}
                >
                  Crear contacto
                </button>
                <button
                  className="button button-line"
                  type="button"
                  onClick={() => selectClient('')}
                >
                  Continuar sin contacto
                </button>
              </div>
            )}
          </section>
        )}
        {(client || isContactManagementOpen) && (
          <details
            className="commercial-advanced-tools"
            open={isContactManagementOpen}
            onToggle={(event) => setIsContactManagementOpen(event.currentTarget.open)}
          >
            <summary>Administrar contacto</summary>
            {!readOnly && (
              <div className="commercial-management-actions">
                <label className="field">
                  <span>Contacto vinculado</span>
                  <select
                    value={quote.clientId ?? ''}
                    onChange={(event) => selectClient(event.target.value)}
                  >
                    <option value="">Sin contacto vinculado</option>
                    {quote.clientId && !client && (
                      <option value={quote.clientId}>Contacto no disponible</option>
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
                    className="button button-line"
                    type="button"
                    onClick={() => setForm('newClient')}
                  >
                    Crear contacto
                  </button>
                  {client && (
                    <button
                      className="button button-line"
                      type="button"
                      onClick={() => setForm('editClient')}
                    >
                      Editar contacto
                    </button>
                  )}
                </div>
                {(form === 'newClient' || form === 'editClient') && (
                  <ClientForm
                    key={form + (client?.id ?? '')}
                    client={form === 'editClient' ? client : undefined}
                    onSave={persistClient}
                    onCancel={() => setForm(null)}
                  />
                )}
              </div>
            )}
          </details>
        )}
        {client && (opportunity || isWorkManagementOpen) && (
          <details
            className="commercial-advanced-tools"
            open={isWorkManagementOpen}
            onToggle={(event) => setIsWorkManagementOpen(event.currentTarget.open)}
          >
            <summary>Administrar obra o trabajo</summary>
            {!readOnly && (
              <div className="commercial-management-actions">
                <label className="field">
                  <span>Vincular obra o trabajo</span>
                  <select
                    value={quote.opportunityId ?? ''}
                    onChange={(event) => {
                      setForm(null);
                      setFeedback('');
                      onAssociate(
                        client,
                        availableOpportunities.find((item) => item.id === event.target.value),
                      );
                    }}
                  >
                    <option value="">Sin obra o trabajo vinculado</option>
                    {quote.opportunityId && !opportunity && (
                      <option value={quote.opportunityId}>Obra o trabajo no disponible</option>
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
                    className="button button-line"
                    type="button"
                    onClick={() => setForm('newOpportunity')}
                  >
                    Crear obra o trabajo
                  </button>
                  {opportunity && (
                    <button
                      className="button button-line"
                      type="button"
                      onClick={() => setForm('editOpportunity')}
                    >
                      Editar obra o trabajo
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
              </div>
            )}
            {opportunity && (
              <CommercialOutcomePanel
                opportunity={opportunity}
                quote={quote}
                savedQuotes={savedQuotes}
                onRecord={recordCommercialOutcome}
              />
            )}
            {opportunityQuotes.length > 0 && (
              <div className="opportunity-quotes">
                <h3>Presupuestos vinculados</h3>
                <ul>
                  {opportunityQuotes.map((savedQuote) => (
                    <li key={savedQuote.id}>
                      <strong>{savedQuote.id}</strong> ·{' '}
                      {savedQuote.status === 'draft' ? 'Borrador' : 'Finalizado'}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!readOnly && (
              <p className="commercial-note">
                Guardá el borrador o finalizalo para conservar la asociación. Editar una obra o
                trabajo no cambia los textos del documento.
              </p>
            )}
          </details>
        )}
        {feedback && (
          <p className="commercial-note" role="status">
            {feedback}
          </p>
        )}
        {contactChannel && (
          <ContactAssistant
            context={{ client, opportunity, quote: quote as SavedQuote }}
            subject={
              opportunity
                ? { kind: 'opportunity', opportunityId: opportunity.id }
                : { kind: 'quote', quoteId: quote.id }
            }
            initialChannel={contactChannel}
            onClose={() => setContactChannel(null)}
            onRecorded={() => refresh()}
          />
        )}
      </section>
    </>
  );
}
