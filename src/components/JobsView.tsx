import { useMemo, useState } from 'react';
import {
  countJobsByStage,
  filterJobs,
  jobStageLabels,
  jobStageOrder,
  type JobRow,
  type JobStageFilter,
} from '../utils/jobList';
import { formatCurrency } from '../utils/quoteFormatting';
import { UiIcon } from './UiIcon';

interface Props {
  rows: readonly JobRow[];
  onOpen: (row: JobRow) => void;
  onNewProspect: () => void;
  /** The prospect list, with CSV import and archived prospects. */
  onShowProspects: () => void;
}

const filterOrder: readonly JobStageFilter[] = ['open', ...jobStageOrder, 'all'];
const filterLabels: Record<JobStageFilter, string> = {
  ...jobStageLabels,
  open: 'Abiertos',
  all: 'Todos',
};

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

/** Every sale in one list, from a new prospect to the outcome, filtered by stage. */
export function JobsView({ rows, onOpen, onNewProspect, onShowProspects }: Props) {
  const [stage, setStage] = useState<JobStageFilter>('open');
  const [query, setQuery] = useState('');
  const counts = useMemo(() => countJobsByStage(rows), [rows]);
  const visible = useMemo(() => filterJobs(rows, { stage, query }), [rows, stage, query]);
  const now = new Date().toISOString();

  return (
    <main className="app-shell jobs-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Ventro · Trabajos</p>
          <h1>Trabajos</h1>
          <p className="page-description">
            Cada venta, desde el primer contacto hasta que se gana o se pierde.
          </p>
        </div>
        <div className="header-actions">
          <button className="button button-line" type="button" onClick={onShowProspects}>
            <UiIcon name="users" /> Prospectos e importación
          </button>
          <button className="button button-primary" type="button" onClick={onNewProspect}>
            <UiIcon name="plus" /> Nuevo prospecto
          </button>
        </div>
      </header>

      <section className="quote-card jobs-list" aria-label="Lista de trabajos">
        <div className="jobs-toolbar">
          <div className="jobs-stages" role="group" aria-label="Filtrar por etapa">
            {filterOrder.map((value) => (
              <button
                key={value}
                className={`jobs-stage-chip ${stage === value ? 'is-selected' : ''}`}
                type="button"
                aria-pressed={stage === value}
                onClick={() => setStage(value)}
              >
                {filterLabels[value]} <span className="jobs-stage-count">{counts[value]}</span>
              </button>
            ))}
          </div>
          <label className="field jobs-search">
            <span>Buscar</span>
            <input
              type="search"
              value={query}
              placeholder="Nombre, empresa o servicio"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>

        {visible.length ? (
          <ul className="jobs-rows">
            {visible.map((row) => (
              <li key={`${row.kind}-${row.id}`}>
                <button className="jobs-row" type="button" onClick={() => onOpen(row)}>
                  <span className="jobs-identity">
                    <span className="prospect-avatar" aria-hidden="true">
                      {initials(row.name)}
                    </span>
                    <span>
                      <strong>{row.name}</strong>
                      <span className="jobs-muted">
                        {[row.company, row.service].filter(Boolean).join(' · ') || 'Sin servicio'}
                      </span>
                    </span>
                  </span>
                  <span className={`jobs-stage jobs-stage-${row.stage}`}>
                    {jobStageLabels[row.stage]}
                  </span>
                  <span className="jobs-amount">
                    {row.amount !== undefined ? formatCurrency(row.amount) : '—'}
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
                  <UiIcon name="chevron-right" className="jobs-chevron" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state">
            <h3>{rows.length ? 'No hay trabajos con este filtro' : 'Todavía no hay trabajos'}</h3>
            <p>
              {rows.length
                ? 'Probá con otra etapa o buscá por otro nombre.'
                : 'Cargá un prospecto para empezar tu primera venta.'}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
