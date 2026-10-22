import { useState } from 'react';
import type { FollowUpFilters, FollowUpInboxItem } from '../types/followUpInbox';
import { defaultFollowUpFilters, filterFollowUpInbox } from '../utils/followUpInbox';
import { businessTimeZone } from '../utils/opportunityNextAction';
import type { RegisterResultInput } from './RegisterResultDrawer';

interface Props {
  items: readonly FollowUpInboxItem[];
  issues: readonly string[];
  onOpen: (item: FollowUpInboxItem) => void;
  onPrepareContact: (item: FollowUpInboxItem) => void;
  onRegisterResult: (item: FollowUpInboxItem) => void;
  onShowCadences: () => void;
}
export interface InboxActionInput {
  actor: string;
  reason: string;
  result: string;
  dueAt: string;
  channel?: RegisterResultInput['channel'];
  nextStep?: RegisterResultInput['nextStep'];
  quoteMode?: RegisterResultInput['quoteMode'];
}
const bucketLabels = {
  overdue: 'Vencidas',
  today: 'Hoy',
  upcoming: 'Próximas',
  missing: 'Sin seguimiento',
} as const;
const channelLabels = {
  call: 'Llamada',
  whatsapp: 'WhatsApp',
  email: 'Email',
  meeting: 'Reunión',
  waitForResponse: 'Esperar respuesta',
  other: 'Otra',
} as const;
const priorityLabels = { high: 'Alta', medium: 'Media', low: 'Baja' } as const;

export function OpportunityNextActionsInbox({
  items,
  issues,
  onOpen,
  onPrepareContact,
  onRegisterResult,
  onShowCadences,
}: Props) {
  const [filters, setFilters] = useState<FollowUpFilters>(defaultFollowUpFilters);
  const now = new Date();
  const all = items;
  const visible = filterFollowUpInbox(all, filters, now);
  const responsibleOptions = [...new Set(all.map((item) => item.responsible))].sort((a, b) =>
    a.localeCompare(b, 'es'),
  );
  const set = <K extends keyof FollowUpFilters>(key: K, value: FollowUpFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));
  return (
    <main className="app-shell follow-up-inbox">
      <header className="saved-quotes-header">
        <div>
          <p className="eyebrow">Seguimiento comercial</p>
          <h1>A quién contactar hoy</h1>
          <p className="page-description">
            Acciones calculadas al abrir la bandeja. No se envían mensajes automáticamente.
          </p>
        </div>
      </header>
      {issues.length > 0 && (
        <p className="commercial-warning" role="alert">
          No se pudieron recuperar todos los datos de seguimiento. Se muestran los registros válidos
          disponibles.
        </p>
      )}
      <section className="follow-up-cadences-access" aria-label="Automatizaciones de seguimiento">
        <div>
          <strong>Automatizaciones de seguimiento</strong>
          <span>Administrá recordatorios y secuencias para tareas comerciales</span>
        </div>
        <button className="button button-line" type="button" onClick={onShowCadences}>
          Ver automatizaciones
        </button>
      </section>
      <section className="follow-up-summary" aria-label="Resumen de seguimiento">
        {(Object.keys(bucketLabels) as (keyof typeof bucketLabels)[]).map((bucket) => (
          <button
            key={bucket}
            type="button"
            className="follow-up-summary-card"
            onClick={() => set('bucket', filters.bucket === bucket ? 'all' : bucket)}
            aria-pressed={filters.bucket === bucket}
          >
            <strong>{all.filter((item) => item.bucket === bucket).length}</strong>
            <span>{bucketLabels[bucket]}</span>
          </button>
        ))}
      </section>
      <section className="quote-card follow-up-tools" aria-label="Filtros de seguimiento">
        <label className="field">
          <span>Buscar</span>
          <input
            value={filters.search}
            onChange={(event) => set('search', event.target.value)}
            placeholder="Contacto, obra o trabajo, o presupuesto"
          />
        </label>
        <label className="field">
          <span>Estado</span>
          <select
            value={filters.bucket}
            onChange={(event) => set('bucket', event.target.value as FollowUpFilters['bucket'])}
          >
            <option value="all">Todos</option>
            {Object.entries(bucketLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Responsable</span>
          <select
            value={filters.responsible}
            onChange={(event) => set('responsible', event.target.value)}
          >
            <option value="all">Todos</option>
            {responsibleOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Canal</span>
          <select
            value={filters.channel}
            onChange={(event) => set('channel', event.target.value as FollowUpFilters['channel'])}
          >
            <option value="all">Todos</option>
            {Object.entries(channelLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Prioridad</span>
          <select
            value={filters.priority}
            onChange={(event) => set('priority', event.target.value as FollowUpFilters['priority'])}
          >
            <option value="all">Todas</option>
            {Object.entries(priorityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Ordenar por</span>
          <select
            value={filters.sort}
            onChange={(event) => set('sort', event.target.value as FollowUpFilters['sort'])}
          >
            <option value="priority">Prioridad</option>
            <option value="date">Fecha</option>
          </select>
        </label>
        <label className="commercial-consent">
          <input
            type="checkbox"
            checked={filters.nextSevenDays}
            onChange={(event) => set('nextSevenDays', event.target.checked)}
          />
          Próximos 7 días
        </label>
      </section>
      {(Object.keys(bucketLabels) as (keyof typeof bucketLabels)[]).map((bucket) => {
        const items = visible.filter((item) => item.bucket === bucket);
        return (
          <section className="quote-card inbox-section" key={bucket}>
            <h2>{bucketLabels[bucket]}</h2>
            {items.length === 0 ? (
              <p className="commercial-note">No hay elementos con los filtros actuales.</p>
            ) : (
              <ul className="activity-list">
                {items.map((item) => (
                  <li key={item.id} className="follow-up-item">
                    <div>
                      <strong>{item.clientName}</strong>
                      {item.clientCompany && <small>Empresa: {item.clientCompany}</small>}
                      <span>
                        {item.opportunityName ?? item.quoteName ?? 'Sin contexto disponible'}
                      </span>
                    </div>
                    {item.action && (
                      <span>
                        {new Intl.DateTimeFormat('es-AR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                          timeZone: businessTimeZone,
                        }).format(new Date(item.action.dueAt))}{' '}
                        · {channelLabels[item.channel!]}
                      </span>
                    )}
                    {item.estimatedValue !== undefined && (
                      <small>
                        Valor estimado:{' '}
                        {new Intl.NumberFormat('es-AR', {
                          style: 'currency',
                          currency: 'ARS',
                        }).format(item.estimatedValue)}
                      </small>
                    )}
                    <small>
                      Responsable: {item.responsible} · Prioridad{' '}
                      {priorityLabels[item.priority.level]}
                      {item.priority.reasons.length
                        ? ` · ${item.priority.reasons.join(' · ')}`
                        : ''}
                    </small>
                    {item.cadenceStep && (
                      <small>
                        Cadencia · Paso {item.cadenceStep.current} de {item.cadenceStep.total}
                      </small>
                    )}
                    {item.source !== 'missing' && (
                      <small>Origen: {item.source === 'manual' ? 'Manual' : 'Cadencia'}</small>
                    )}
                    {item.contactRestricted ? (
                      <small className="commercial-warning">
                        Contacto restringido: no contactar.
                      </small>
                    ) : (
                      <small>
                        {item.phone ? `Tel. ${item.phone}` : 'Teléfono pendiente'} ·{' '}
                        {item.email ? item.email : 'Email pendiente'}
                      </small>
                    )}
                    <div className="commercial-actions">
                      <button
                        className="button button-line"
                        type="button"
                        onClick={() => onOpen(item)}
                      >
                        Abrir contexto
                      </button>
                      {item.action && !item.contactRestricted && (
                        <>
                          {(item.channel === 'call' || item.channel === 'whatsapp') && (
                            <button
                              className="button button-line"
                              type="button"
                              onClick={() => onPrepareContact(item)}
                            >
                              Preparar contacto
                            </button>
                          )}
                          <button
                            className="button button-primary"
                            type="button"
                            onClick={() => onRegisterResult(item)}
                          >
                            Registrar resultado
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </main>
  );
}
