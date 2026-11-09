import { useMemo, useState } from 'react';
import {
  clientFilterLabels,
  clientFilterOrder,
  countClients,
  filterClients,
  getClientContactLinks,
  type ClientFilter,
  type ClientRow,
} from '../utils/clientList';
import { isPendingEmail, isPendingPhone } from '../utils/clientValidation';
import { jobStageLabels, type JobRow } from '../utils/jobList';
import { buildContactMessage } from '../utils/whatsappMessage';
import { useContactSender } from '../utils/useContactSender';
import { formatCurrency } from '../utils/quoteFormatting';
import { UiIcon } from './UiIcon';

interface Props {
  rows: readonly ClientRow[];
  onOpenJob: (job: JobRow) => void;
}

const dueFormat = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toLocaleUpperCase('es'))
    .join('');

function jobsSummary(row: ClientRow): string {
  if (!row.jobs.length) return 'Sin trabajos';
  const parts = [`${row.jobs.length} ${row.jobs.length === 1 ? 'trabajo' : 'trabajos'}`];
  if (row.openJobs) parts.push(`${row.openJobs} ${row.openJobs === 1 ? 'abierto' : 'abiertos'}`);
  if (row.wonJobs) parts.push(`${row.wonJobs} ${row.wonJobs === 1 ? 'ganado' : 'ganados'}`);
  return parts.join(' · ');
}

/** Everyone who is already a client, their contact and their jobs. */
export function ClientsView({ rows, onOpenJob }: Props) {
  const [filter, setFilter] = useState<ClientFilter>('all');
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const sender = useContactSender();
  const counts = useMemo(() => countClients(rows), [rows]);
  const visible = useMemo(() => filterClients(rows, { filter, query }), [rows, filter, query]);
  const now = new Date().toISOString();

  return (
    <main className="app-shell jobs-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Ventro · Clientes</p>
          <h1>Clientes</h1>
          <p className="page-description">
            Cada cliente con sus datos de contacto y todos sus trabajos.
          </p>
        </div>
      </header>

      <section className="quote-card jobs-list" aria-label="Lista de clientes">
        <div className="jobs-toolbar">
          <div className="jobs-stages" role="group" aria-label="Filtrar clientes">
            {clientFilterOrder.map((value) => (
              <button
                key={value}
                className={`jobs-stage-chip ${filter === value ? 'is-selected' : ''}`}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {clientFilterLabels[value]}{' '}
                <span className="jobs-stage-count">{counts[value]}</span>
              </button>
            ))}
          </div>
          <label className="field jobs-search">
            <span>Buscar</span>
            <input
              type="search"
              value={query}
              placeholder="Nombre, empresa, teléfono o servicio"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>

        {visible.length ? (
          <ul className="jobs-rows">
            {visible.map((row) => {
              const { client } = row;
              const expanded = expandedId === client.id;
              const panelId = `client-panel-${client.id}`;
              const links = getClientContactLinks(
                client,
                buildContactMessage({
                  ...sender,
                  purpose: 'followUp',
                  contactName: client.name,
                  service: row.jobs.find((job) => !['won', 'lost'].includes(job.stage))?.service,
                }),
              );
              const contact = [
                isPendingPhone(client.phone) ? '' : client.phone,
                isPendingEmail(client.email) ? '' : client.email,
              ].filter(Boolean);
              return (
                <li key={client.id} className={`clients-item ${expanded ? 'is-expanded' : ''}`}>
                  <button
                    className="jobs-row clients-row"
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    onClick={() => setExpandedId(expanded ? null : client.id)}
                  >
                    <span className="jobs-identity">
                      <span className="prospect-avatar" aria-hidden="true">
                        {initials(client.name)}
                      </span>
                      <span>
                        <strong>{client.name}</strong>
                        <span className="jobs-muted">
                          {[client.company, ...contact].filter(Boolean).join(' · ') ||
                            'Sin datos de contacto'}
                        </span>
                      </span>
                    </span>
                    <span className="clients-summary">{jobsSummary(row)}</span>
                    <span className="jobs-amount">
                      {row.wonJobs ? formatCurrency(row.wonAmount) : '—'}
                    </span>
                    <span
                      className={`jobs-next ${row.nextStep && row.nextStep.dueAt < now ? 'is-overdue' : ''}`}
                    >
                      {row.nextStep ? (
                        <>
                          <span>{row.nextStep.description}</span>
                          <span className="jobs-muted">
                            {dueFormat.format(new Date(row.nextStep.dueAt))}
                          </span>
                        </>
                      ) : (
                        <span className="jobs-muted">Sin próximo paso</span>
                      )}
                    </span>
                    <UiIcon name="chevron-down" className="jobs-chevron clients-chevron" />
                  </button>

                  {expanded && (
                    <div className="clients-panel" id={panelId}>
                      <div className="clients-contact">
                        {client.doNotContact ? (
                          <p className="jobs-muted">Pidió no ser contactado.</p>
                        ) : links.length ? (
                          links.map((link) => (
                            <a
                              key={link.channel}
                              className="button button-secondary"
                              href={link.href}
                              target={link.channel === 'whatsapp' ? '_blank' : undefined}
                              rel={link.channel === 'whatsapp' ? 'noreferrer' : undefined}
                            >
                              <UiIcon name={link.channel} /> {link.label}
                            </a>
                          ))
                        ) : (
                          <p className="jobs-muted">Faltan el teléfono y el email.</p>
                        )}
                      </div>
                      {row.jobs.length ? (
                        <ul className="clients-jobs" aria-label={`Trabajos de ${client.name}`}>
                          {row.jobs.map((job) => (
                            <li key={job.id}>
                              <button
                                className="clients-job"
                                type="button"
                                onClick={() => onOpenJob(job)}
                              >
                                <span>{job.service || 'Sin servicio'}</span>
                                <span className={`jobs-stage jobs-stage-${job.stage}`}>
                                  {jobStageLabels[job.stage]}
                                </span>
                                <span className="jobs-amount">
                                  {job.amount !== undefined ? formatCurrency(job.amount) : '—'}
                                </span>
                                <UiIcon name="chevron-right" className="jobs-chevron" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="jobs-muted">Todavía no tiene trabajos.</p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="empty-state">
            <h3>{rows.length ? 'No hay clientes con este filtro' : 'Todavía no hay clientes'}</h3>
            <p>
              {rows.length
                ? 'Probá con otro filtro o buscá por otro dato.'
                : 'Aparecen acá cuando convertís un prospecto o cargás un cliente en un presupuesto.'}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
