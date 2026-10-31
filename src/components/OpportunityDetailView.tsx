import { useEffect, useMemo, useState } from 'react';
import { ActivityTimeline } from './ActivityTimeline';
import { ClientForm } from './ClientForm';
import { UiIcon } from './UiIcon';
import type { Client, ClientInput } from '../types/client';
import type { Opportunity, OpportunityPipelineStage } from '../types/opportunity';
import type { SavedQuote } from '../types/quote';
import type { Activity } from '../types/activity';
import { businessTimeZone } from '../utils/opportunityNextAction';
import { loadActivities } from '../utils/activityStorage';
import { getActivityResultLabel } from '../utils/activityTimeline';
import { mirrorProspectActivitiesToOpportunity } from '../utils/prospectConversion';
import { loadProspects } from '../utils/prospectStorage';
import { getOpportunityQuoteAction } from '../utils/opportunityQuoteAction';
import { canCreateQuoteVersion } from '../utils/quoteVersioning';

type DetailTab = 'summary' | 'activity' | 'quotes' | 'notes' | 'files';
type OpportunityDataDraft = {
  address: string;
  serviceOfInterest: string;
  estimatedValue: string;
  closingProbability: string;
  estimatedCloseDate: string;
  origin: string;
  tag: string;
  responsibleSeller: string;
};

interface Props {
  opportunity: Opportunity;
  client?: Client;
  quotes: readonly SavedQuote[];
  onBack: () => void;
  onSaveOpportunity: (opportunity: Opportunity, event: string) => boolean;
  onUpdateClient: (input: ClientInput) => string | null | Promise<string | null>;
  onRegisterResult: () => void;
  onCreateQuote: () => void;
  onContinueQuote: (quote: SavedQuote) => void;
  onOpenQuote: (quote: SavedQuote) => void;
  onCreateQuoteVersion: (quote: SavedQuote, reason: string) => void;
  activities: readonly Activity[];
}

const tabLabels: Record<DetailTab, string> = {
  summary: 'Resumen',
  activity: 'Actividad',
  quotes: 'Presupuestos',
  notes: 'Notas',
  files: 'Archivos',
};
const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const preferredChannelLabels = {
  phone: 'Teléfono',
  whatsapp: 'WhatsApp',
  email: 'Email',
  instagram: 'Instagram',
  '': 'Sin preferencia',
} as const;

const fullDateTime = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'full',
  timeStyle: 'short',
  timeZone: businessTimeZone,
});

function dateTime(iso: string) {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: businessTimeZone,
  }).format(new Date(iso));
}

export function OpportunityDetailView({
  opportunity,
  client,
  quotes,
  onBack,
  onSaveOpportunity,
  onUpdateClient,
  onRegisterResult,
  onCreateQuote,
  onContinueQuote,
  onOpenQuote,
  onCreateQuoteVersion,
  activities,
}: Props) {
  const [tab, setTab] = useState<DetailTab>('summary');
  const [copied, setCopied] = useState('');
  const [, setActivityRevision] = useState(0);
  const [editingOpportunityData, setEditingOpportunityData] = useState(false);
  const [dataError, setDataError] = useState('');
  const [editingClient, setEditingClient] = useState(false);
  const [dataDraft, setDataDraft] = useState<OpportunityDataDraft>(() => ({
    address: opportunity.address,
    serviceOfInterest: opportunity.qualification?.serviceOfInterest ?? '',
    estimatedValue: opportunity.qualification?.estimatedValue?.toString() ?? '',
    closingProbability: opportunity.closingProbability?.toString() ?? '',
    estimatedCloseDate: opportunity.estimatedCloseDate?.slice(0, 10) ?? '',
    origin: opportunity.origin ?? '',
    tag: opportunity.tag ?? '',
    responsibleSeller: opportunity.responsibleSeller ?? '',
  }));
  const relatedQuotes = useMemo(
    () =>
      quotes
        .filter((quote) => quote.opportunityId === opportunity.id)
        .sort((a, b) => (b.version ?? 1) - (a.version ?? 1)),
    [opportunity.id, quotes],
  );
  const action = opportunity.nextAction?.status === 'pending' ? opportunity.nextAction : undefined;
  const qualification = opportunity.qualification;
  const isMissingClient = !client;
  const sourceProspect = loadProspects().items.find(
    (item) => item.conversion?.draft.opportunityId === opportunity.id,
  );
  const currentQuote = relatedQuotes[0];
  const canCreateVersion = Boolean(
    currentQuote && canCreateQuoteVersion(currentQuote, opportunity),
  );
  const quoteAction = getOpportunityQuoteAction(relatedQuotes);
  const isSendQuoteAction =
    action?.kind === 'sendQuote' ||
    action?.description.trim().toLowerCase() === 'enviar presupuesto';
  const currentStage = opportunity.pipelineStage ?? 'opportunity';
  const pipeline: readonly (readonly [OpportunityPipelineStage, string])[] = [
    ['prospect', 'Prospecto'],
    ['contacted', 'Contactado'],
    ['opportunity', 'Oportunidad'],
    ['proposal', 'Propuesta'],
    currentStage === 'lost' ? ['lost', 'Perdida'] : ['won', 'Ganada'],
  ];

  function runQuoteAction() {
    if (quoteAction.type === 'create') {
      onCreateQuote();
      return;
    }
    if (quoteAction.type === 'continueDraft') {
      onContinueQuote(quoteAction.quote);
      return;
    }
    onOpenQuote(quoteAction.quote);
  }

  const quoteActionLabel =
    quoteAction.type === 'create'
      ? 'Crear presupuesto'
      : quoteAction.type === 'continueDraft'
        ? 'Continuar presupuesto'
        : quoteAction.type === 'openPrepared'
          ? 'Abrir presupuesto para enviar'
          : 'Ver presupuesto enviado';
  useEffect(() => {
    const refreshActivities = () => setActivityRevision((current) => current + 1);
    window.addEventListener('activitiesupdated', refreshActivities);
    const prospect = loadProspects().items.find(
      (item) =>
        item.conversion?.state === 'completed' &&
        item.conversion.draft.opportunityId === opportunity.id,
    );
    if (prospect) mirrorProspectActivitiesToOpportunity(prospect, prospect.conversion!.draft);
    return () => window.removeEventListener('activitiesupdated', refreshActivities);
  }, [opportunity.id]);

  const storedActivities = loadActivities().items;
  const opportunityActivities = useMemo(() => {
    const byId = new Map<string, Activity>();
    [...activities, ...storedActivities].forEach((activity) => byId.set(activity.id, activity));
    return [...byId.values()];
  }, [activities, storedActivities]);
  const recentActivities = opportunityActivities
    .filter(
      (item) =>
        item.subject.kind === 'opportunity' && item.subject.opportunityId === opportunity.id,
    )
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
    .slice(0, 4);

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(`${label} copiado`);
    } catch {
      setCopied(`No se pudo copiar ${label.toLocaleLowerCase('es')}.`);
    }
  }
  function toggleOpportunityDataEditing() {
    if (!editingOpportunityData) {
      setEditingOpportunityData(true);
      return;
    }
    const estimatedValue = dataDraft.estimatedValue.trim()
      ? Number(dataDraft.estimatedValue)
      : undefined;
    const closingProbability = dataDraft.closingProbability.trim()
      ? Number(dataDraft.closingProbability)
      : undefined;
    const updated: Opportunity = {
      ...opportunity,
      address: dataDraft.address.trim(),
      responsibleSeller: dataDraft.responsibleSeller.trim(),
      origin: dataDraft.origin.trim() || undefined,
      tag: dataDraft.tag.trim() || undefined,
      closingProbability: Number.isFinite(closingProbability) ? closingProbability : undefined,
      estimatedCloseDate: dataDraft.estimatedCloseDate
        ? new Date(`${dataDraft.estimatedCloseDate}T12:00:00-03:00`).toISOString()
        : undefined,
      updatedAt: new Date().toISOString(),
    };
    const service = dataDraft.serviceOfInterest.trim();
    const hasEstimatedValue = Number.isFinite(estimatedValue);
    if (service) {
      updated.qualification = {
        interestLevel: opportunity.qualification?.interestLevel ?? 'medium',
        detectedNeed: opportunity.qualification?.detectedNeed.trim() || service,
        serviceOfInterest: service,
        estimatedValue: hasEstimatedValue ? estimatedValue : undefined,
      };
    } else if (opportunity.qualification || hasEstimatedValue) {
      setDataError('Ingresá el servicio de interés para guardar la calificación.');
      return;
    } else {
      delete updated.qualification;
    }
    if (onSaveOpportunity(updated, 'edited')) {
      setDataError('');
      setEditingOpportunityData(false);
    } else {
      setDataError('No se pudieron guardar los datos de la oportunidad. Revisá los campos.');
    }
  }

  return (
    <main className="app-shell opportunity-detail-view">
      <button className="button button-link opportunity-back" type="button" onClick={onBack}>
        ← Volver a seguimiento
      </button>
      <header className="opportunity-detail-header">
        <div>
          <p className="eyebrow">Seguimiento / Oportunidades</p>
          <div className="opportunity-title-row">
            <h1>{opportunity.name}</h1>
            <span className="status-badge prospect-status-contacted">
              {currentStage === 'proposal'
                ? 'Propuesta'
                : currentStage === 'won'
                  ? 'Ganada'
                  : currentStage === 'lost'
                    ? 'Perdida'
                    : 'En seguimiento'}
            </span>
          </div>
          <p className="page-description">
            {client?.company && `${client.company} · `}
            {client?.name ?? 'Cliente no disponible'}
          </p>
        </div>
        <div className="opportunity-header-actions">
          <button className="button button-primary" type="button" onClick={onRegisterResult}>
            <UiIcon name="document" /> Registrar resultado
          </button>
        </div>
      </header>
      {isMissingClient && (
        <p className="commercial-warning" role="alert">
          No se encontró el cliente vinculado. La oportunidad se muestra en modo de solo lectura.
        </p>
      )}
      <section className="quote-card opportunity-pipeline-card" aria-label="Pipeline comercial">
        <h2>Pipeline comercial</h2>
        <div className="opportunity-pipeline">
          {pipeline.map(([stage, label], index) => {
            const active = stage === currentStage;
            const reached = pipeline.findIndex(([value]) => value === currentStage) >= index;
            return (
              <div
                className={`opportunity-pipeline-step ${active ? 'active' : ''} ${reached ? 'reached' : ''} ${stage === 'lost' ? 'lost-stage' : ''}`}
                key={stage}
              >
                <span className="opportunity-pipeline-icon">
                  <UiIcon
                    name={
                      stage === 'prospect'
                        ? 'person'
                        : stage === 'contacted'
                          ? 'phone'
                          : stage === 'opportunity' || stage === 'proposal'
                            ? 'document'
                            : stage === 'lost'
                              ? 'x-circle'
                              : 'trophy'
                    }
                  />
                </span>
                <strong>{label}</strong>
                {index < pipeline.length - 1 && <i />}
              </div>
            );
          })}
        </div>
        {currentQuote && (
          <div className="opportunity-current-proposal">
            <span className="opportunity-proposal-icon">
              <UiIcon name="document" />
            </span>
            <div>
              <strong>Presupuesto actual</strong>
              <span>
                {currentQuote.id} · V{currentQuote.version ?? 1}
              </span>
            </div>
            <span className="opportunity-sent-chip">
              <UiIcon name="whatsapp" />{' '}
              {currentQuote.commercialStatus === 'sent' ? 'Enviada' : currentQuote.commercialStatus}
            </span>
            <button className="button button-line" type="button" onClick={() => setTab('quotes')}>
              <UiIcon name="document" /> Ver versiones ({relatedQuotes.length})
            </button>
          </div>
        )}
      </section>
      <div className="opportunity-tabs" role="tablist" aria-label="Secciones de oportunidad">
        {(Object.keys(tabLabels) as DetailTab[]).map((item) => (
          <button
            key={item}
            className={tab === item ? 'opportunity-tab opportunity-tab-active' : 'opportunity-tab'}
            role="tab"
            type="button"
            aria-selected={tab === item}
            onClick={() => setTab(item)}
          >
            {tabLabels[item]}
          </button>
        ))}
      </div>
      {tab === 'summary' && (
        <div className="opportunity-detail-grid">
          <div className="opportunity-detail-main">
            <section
              className="quote-card opportunity-pipeline-card"
              aria-label="Pipeline comercial"
            >
              <h2>Pipeline comercial</h2>
              <div className="opportunity-pipeline">
                {pipeline.map(([stage, label], index) => {
                  const active = stage === currentStage;
                  const reached = pipeline.findIndex(([value]) => value === currentStage) >= index;
                  return (
                    <div
                      className={`opportunity-pipeline-step ${active ? 'active' : ''} ${reached ? 'reached' : ''} ${reached && !active ? 'completed' : ''} ${stage === 'lost' ? 'lost-stage' : ''}`}
                      key={stage}
                    >
                      <span className="opportunity-pipeline-icon">
                        <UiIcon
                          name={
                            stage === 'prospect'
                              ? 'person'
                              : stage === 'contacted'
                                ? 'phone'
                                : stage === 'opportunity' || stage === 'proposal'
                                  ? 'document'
                                  : stage === 'lost'
                                    ? 'x-circle'
                                    : 'trophy'
                          }
                        />
                        {reached && !active && (
                          <span className="opportunity-pipeline-complete">
                            <UiIcon name="check" />
                          </span>
                        )}
                      </span>
                      <strong>{label}</strong>
                      {index < pipeline.length - 1 && <i />}
                    </div>
                  );
                })}
              </div>
              {currentQuote && (
                <div className="opportunity-current-proposal">
                  <span className="opportunity-proposal-icon">
                    <UiIcon name="document" />
                  </span>
                  <div>
                    <strong>Propuesta actual</strong>
                    <span>
                      {currentQuote.id} · V{currentQuote.version ?? 1}
                    </span>
                  </div>
                  <span className="opportunity-sent-chip">
                    <UiIcon name="whatsapp" />{' '}
                    {currentQuote.commercialStatus === 'sent'
                      ? 'Enviada'
                      : currentQuote.commercialStatus}
                  </span>
                  <button
                    className="button button-line"
                    type="button"
                    onClick={() => setTab('quotes')}
                  >
                    <UiIcon name="document" /> Ver versiones ({relatedQuotes.length})
                  </button>
                </div>
              )}
            </section>
            <section className="quote-card opportunity-next-step">
              <p className="eyebrow">Próximo paso</p>
              {action ? (
                <div className="opportunity-step-main">
                  <div className="opportunity-step-icon" aria-hidden="true">
                    <UiIcon
                      name={
                        action.type === 'whatsapp'
                          ? 'whatsapp'
                          : action.type === 'email'
                            ? 'email'
                            : 'calendar'
                      }
                    />
                  </div>
                  <div>
                    <h2>{action.description}</h2>
                    <p>
                      <UiIcon name="calendar" /> {fullDateTime.format(new Date(action.dueAt))}
                    </p>
                    <p>
                      <UiIcon name="person" /> {action.responsible}
                      {client?.company && ` · ${client.company}`}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <h2>Sin próximo paso</h2>
                  <p className="commercial-note">
                    Programá una acción para sostener el seguimiento.
                  </p>
                </>
              )}
              {!isMissingClient && isSendQuoteAction && (
                <button className="button button-primary" type="button" onClick={runQuoteAction}>
                  <UiIcon name="document" /> {quoteActionLabel}
                </button>
              )}
            </section>
            {currentQuote && (
              <section className="quote-card opportunity-versions-card">
                <div className="quote-heading">
                  <div>
                    <p className="eyebrow">Propuesta</p>
                    <h2>Versiones del presupuesto</h2>
                  </div>
                  {canCreateVersion ? (
                    <button
                      className="button button-line"
                      type="button"
                      onClick={() =>
                        onCreateQuoteVersion(currentQuote, 'El cliente solicitó cambios.')
                      }
                    >
                      Crear V{(currentQuote.version ?? 1) + 1} desde V{currentQuote.version ?? 1}
                    </button>
                  ) : (
                    <p className="commercial-note">
                      Presupuesto aceptado: la oportunidad está cerrada.
                    </p>
                  )}
                </div>
                <ul className="opportunity-quote-list">
                  {relatedQuotes.map((quote) => (
                    <li key={quote.id}>
                      <div>
                        <strong>
                          V{quote.version ?? 1} · {quote.projectName || quote.id}
                        </strong>
                        <small>
                          {quote.commercialStatus === 'sent' ? 'Enviada' : quote.commercialStatus} ·{' '}
                          {dateTime(quote.savedAt)}
                        </small>
                        {quote.basedOnQuoteId && (
                          <small>
                            Creada desde{' '}
                            {relatedQuotes.find((item) => item.id === quote.basedOnQuoteId)?.id ??
                              quote.basedOnQuoteId}
                          </small>
                        )}
                      </div>
                      <button
                        className="button button-line"
                        type="button"
                        onClick={() => onOpenQuote(quote)}
                      >
                        Abrir versión
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className="quote-card opportunity-data-card">
              <div className="opportunity-data-heading">
                <h2>Datos de oportunidad</h2>
                <button
                  className="button button-link"
                  type="button"
                  onClick={toggleOpportunityDataEditing}
                >
                  <UiIcon name={editingOpportunityData ? 'check' : 'edit'} />
                  {editingOpportunityData ? 'Guardar' : 'Editar'}
                </button>
              </div>
              {dataError && (
                <p className="form-error" role="alert">
                  {dataError}
                </p>
              )}
              <dl>
                <div className="opportunity-data-row">
                  <span className="opportunity-data-icon" aria-hidden="true">
                    <UiIcon name="map-pin" />
                  </span>
                  <dt>Dirección</dt>
                  <dd>
                    {editingOpportunityData ? (
                      <input
                        className="opportunity-data-input"
                        value={dataDraft.address}
                        onChange={(event) =>
                          setDataDraft((draft) => ({ ...draft, address: event.target.value }))
                        }
                      />
                    ) : (
                      opportunity.address || 'Sin definir'
                    )}
                  </dd>
                </div>
                <div className="opportunity-data-row">
                  <span className="opportunity-data-icon" aria-hidden="true">
                    <UiIcon name="document" />
                  </span>
                  <dt>Servicio / Tipo</dt>
                  <dd>
                    {editingOpportunityData ? (
                      <input
                        className="opportunity-data-input"
                        value={dataDraft.serviceOfInterest}
                        onChange={(event) =>
                          setDataDraft((draft) => ({
                            ...draft,
                            serviceOfInterest: event.target.value,
                          }))
                        }
                      />
                    ) : (
                      qualification?.serviceOfInterest || 'Sin definir'
                    )}
                  </dd>
                </div>
                <div className="opportunity-data-row">
                  <span className="opportunity-data-icon" aria-hidden="true">
                    <UiIcon name="document" />
                  </span>
                  <dt>Valor estimado</dt>
                  <dd>
                    {editingOpportunityData ? (
                      <input
                        className="opportunity-data-input"
                        inputMode="decimal"
                        value={dataDraft.estimatedValue}
                        onChange={(event) =>
                          setDataDraft((draft) => ({
                            ...draft,
                            estimatedValue: event.target.value,
                          }))
                        }
                      />
                    ) : qualification?.estimatedValue !== undefined ? (
                      money.format(qualification.estimatedValue)
                    ) : (
                      'Sin definir'
                    )}
                  </dd>
                </div>
                <div className="opportunity-data-row">
                  <span className="opportunity-data-icon" aria-hidden="true">
                    <UiIcon name="activity" />
                  </span>
                  <dt>Probabilidad de cierre</dt>
                  <dd>
                    {editingOpportunityData ? (
                      <input
                        className="opportunity-data-input"
                        inputMode="numeric"
                        value={dataDraft.closingProbability}
                        onChange={(event) =>
                          setDataDraft((draft) => ({
                            ...draft,
                            closingProbability: event.target.value,
                          }))
                        }
                      />
                    ) : opportunity.closingProbability !== undefined ? (
                      `${opportunity.closingProbability}%`
                    ) : (
                      'Sin definir'
                    )}
                  </dd>
                </div>
                <div className="opportunity-data-row">
                  <span className="opportunity-data-icon" aria-hidden="true">
                    <UiIcon name="calendar" />
                  </span>
                  <dt>Fecha estimada de cierre</dt>
                  <dd>
                    {editingOpportunityData ? (
                      <input
                        className="opportunity-data-input"
                        type="date"
                        value={dataDraft.estimatedCloseDate}
                        onChange={(event) =>
                          setDataDraft((draft) => ({
                            ...draft,
                            estimatedCloseDate: event.target.value,
                          }))
                        }
                      />
                    ) : opportunity.estimatedCloseDate ? (
                      dateTime(opportunity.estimatedCloseDate)
                    ) : (
                      'Sin definir'
                    )}
                  </dd>
                </div>
                <div className="opportunity-data-row">
                  <span className="opportunity-data-icon" aria-hidden="true">
                    <UiIcon name="send" />
                  </span>
                  <dt>Origen</dt>
                  <dd>
                    {editingOpportunityData ? (
                      <input
                        className="opportunity-data-input"
                        value={dataDraft.origin}
                        onChange={(event) =>
                          setDataDraft((draft) => ({ ...draft, origin: event.target.value }))
                        }
                      />
                    ) : (
                      opportunity.origin || 'Sin definir'
                    )}
                  </dd>
                </div>
                <div className="opportunity-data-row">
                  <span className="opportunity-data-icon" aria-hidden="true">
                    <UiIcon name="tag" />
                  </span>
                  <dt>Etiqueta</dt>
                  <dd>
                    {editingOpportunityData ? (
                      <input
                        className="opportunity-data-input"
                        value={dataDraft.tag}
                        onChange={(event) =>
                          setDataDraft((draft) => ({ ...draft, tag: event.target.value }))
                        }
                      />
                    ) : (
                      opportunity.tag || 'Sin definir'
                    )}
                  </dd>
                </div>
                <div className="opportunity-data-row">
                  <span className="opportunity-data-icon" aria-hidden="true">
                    <UiIcon name="person" />
                  </span>
                  <dt>Responsable</dt>
                  <dd>
                    {editingOpportunityData ? (
                      <input
                        className="opportunity-data-input"
                        value={dataDraft.responsibleSeller}
                        onChange={(event) =>
                          setDataDraft((draft) => ({
                            ...draft,
                            responsibleSeller: event.target.value,
                          }))
                        }
                      />
                    ) : (
                      opportunity.responsibleSeller || 'Sin asignar'
                    )}
                  </dd>
                </div>
                <div className="opportunity-data-row">
                  <span className="opportunity-data-icon" aria-hidden="true">
                    <UiIcon name="calendar" />
                  </span>
                  <dt>Creado el</dt>
                  <dd>{dateTime(opportunity.createdAt)}</dd>
                </div>
                <div className="opportunity-data-row">
                  <span className="opportunity-data-icon" aria-hidden="true">
                    <UiIcon name="document" />
                  </span>
                  <dt>Versiones</dt>
                  <dd>
                    {relatedQuotes.length
                      ? `${relatedQuotes.length} · V${currentQuote?.version ?? 1} actual`
                      : 'Sin presupuestos'}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
          <aside className="opportunity-detail-side">
            <section className="quote-card opportunity-contact-card">
              <div className="opportunity-contact-heading">
                <h2>Contacto</h2>
                {client && !editingClient && (
                  <button
                    className="button button-line"
                    type="button"
                    onClick={() => setEditingClient(true)}
                  >
                    Editar contacto
                  </button>
                )}
              </div>
              <div className="opportunity-contact-identity">
                <span className="opportunity-avatar">
                  {client?.name
                    ?.split(/\s+/)
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase() ?? '??'}
                </span>
                <div>
                  <strong>{client?.name ?? 'Cliente no disponible'}</strong>
                  {client?.company && <p>{client.company}</p>}
                  <small>Responsable de proyectos</small>
                </div>
              </div>
              {client?.phone && (
                <p className="opportunity-contact-line">
                  <span>
                    <UiIcon name="phone" />
                  </span>
                  {client.phone}
                  <button
                    type="button"
                    aria-label="Copiar teléfono"
                    onClick={() => copy(client.phone, 'Teléfono')}
                  >
                    ⧉
                  </button>
                </p>
              )}
              {client?.email && (
                <p className="opportunity-contact-line">
                  <span>
                    <UiIcon name="email" />
                  </span>
                  {client.email}
                  <button
                    type="button"
                    aria-label="Copiar email"
                    onClick={() => copy(client.email, 'Email')}
                  >
                    ⧉
                  </button>
                </p>
              )}
              {sourceProspect && (
                <section className="opportunity-prospect-context" aria-label="Datos del prospecto">
                  <p className="eyebrow">Datos del prospecto</p>
                  <ul>
                    <li>
                      <UiIcon name="instagram" />
                      <div>
                        <span>Instagram</span>
                        <strong>{sourceProspect.instagram || 'Sin definir'}</strong>
                      </div>
                    </li>
                    <li>
                      <UiIcon name="map-pin" />
                      <div>
                        <span>Dirección</span>
                        <strong>
                          {opportunity.address || sourceProspect.address || 'Sin definir'}
                        </strong>
                      </div>
                    </li>
                    <li>
                      <UiIcon name="send" />
                      <div>
                        <span>Origen</span>
                        <strong>{sourceProspect.source || 'Sin definir'}</strong>
                      </div>
                    </li>
                    <li>
                      <UiIcon name="document" />
                      <div>
                        <span>Servicio potencial</span>
                        <strong>{sourceProspect.potentialService || 'Sin definir'}</strong>
                      </div>
                    </li>
                    <li>
                      <UiIcon
                        name={
                          sourceProspect.preferredChannel === 'whatsapp'
                            ? 'whatsapp'
                            : sourceProspect.preferredChannel === 'email'
                              ? 'email'
                              : sourceProspect.preferredChannel === 'instagram'
                                ? 'instagram'
                                : sourceProspect.preferredChannel === 'phone'
                                  ? 'phone'
                                  : 'help'
                        }
                      />
                      <div>
                        <span>Canal preferido</span>
                        <strong>{preferredChannelLabels[sourceProspect.preferredChannel]}</strong>
                      </div>
                    </li>
                  </ul>
                </section>
              )}
              {copied && (
                <small className="commercial-note" role="status">
                  {copied}
                </small>
              )}
              {client && editingClient && (
                <ClientForm
                  client={client}
                  onSave={async (input) => {
                    const error = await onUpdateClient(input);
                    if (!error) setEditingClient(false);
                    return error;
                  }}
                  onCancel={() => setEditingClient(false)}
                />
              )}
            </section>
            <section className="quote-card opportunity-activity-preview">
              <h2>Actividad reciente</h2>
              {recentActivities.length ? (
                <ol className="opportunity-recent-list">
                  {recentActivities.map((activity) => (
                    <li key={activity.id}>
                      <span className="opportunity-activity-icon">
                        <UiIcon
                          name={
                            activity.type === 'whatsapp'
                              ? 'whatsapp'
                              : activity.type === 'email'
                                ? 'email'
                                : activity.type === 'note'
                                  ? 'note'
                                  : 'document'
                          }
                        />
                      </span>
                      <div>
                        <strong>{getActivityResultLabel(activity)}</strong>
                        <small>{activity.note || 'Actividad registrada'}</small>
                      </div>
                      <time>{new Date(activity.occurredAt).toLocaleDateString('es-AR')}</time>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="commercial-note">Todavía no hay actividades para esta oportunidad.</p>
              )}
              <button
                className="button button-line"
                type="button"
                onClick={() => setTab('activity')}
              >
                Ver toda la actividad
              </button>
            </section>
          </aside>
        </div>
      )}
      {tab === 'activity' && (
        <section className="quote-card opportunity-tab-panel">
          <h2>Actividad</h2>
          <ActivityTimeline
            entrySubject={{ kind: 'opportunity', opportunityId: opportunity.id }}
            nextAction={action}
            subjects={[
              {
                subject: { kind: 'opportunity', opportunityId: opportunity.id },
                label: 'Obra o trabajo',
              },
            ]}
            emptyMessage="Todavía no hay actividades para esta oportunidad."
          />
        </section>
      )}
      {tab === 'notes' && (
        <section className="quote-card opportunity-tab-panel">
          <h2>Notas</h2>
          <ActivityTimeline
            entrySubject={{ kind: 'opportunity', opportunityId: opportunity.id }}
            subjects={[
              {
                subject: { kind: 'opportunity', opportunityId: opportunity.id },
                label: 'Obra o trabajo',
              },
            ]}
            initialFilter="note"
            hideFilters
            noteOnly
            emptyMessage="Todavía no hay notas para esta oportunidad."
            registerLabel="Registrar nota"
          />
        </section>
      )}
      {tab === 'quotes' && (
        <section className="quote-card opportunity-tab-panel">
          <h2>Presupuestos</h2>
          {relatedQuotes.length ? (
            <ul className="opportunity-quote-list">
              {relatedQuotes.map((quote) => (
                <li key={quote.id}>
                  <div>
                    <strong>{quote.projectName || quote.id}</strong>
                    <small>{quote.commercialStatus}</small>
                  </div>
                  <button
                    className="button button-line"
                    type="button"
                    onClick={() => onOpenQuote(quote)}
                  >
                    Abrir presupuesto
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">
              <h3>Aún no hay presupuestos</h3>
              <p>Cuando generes uno vinculado a esta oportunidad aparecerá aquí.</p>
              {!isMissingClient && (
                <button className="button button-primary" type="button" onClick={runQuoteAction}>
                  <UiIcon name="document" /> Crear presupuesto
                </button>
              )}
            </div>
          )}
        </section>
      )}
      {tab === 'files' && (
        <section className="quote-card opportunity-tab-panel empty-state">
          <h2>Archivos</h2>
          <p>Aún no hay archivos adjuntos.</p>
          <p className="commercial-note">
            La carga de documentos se habilitará cuando tenga una persistencia segura, para evitar
            perder archivos al recargar.
          </p>
        </section>
      )}
    </main>
  );
}
