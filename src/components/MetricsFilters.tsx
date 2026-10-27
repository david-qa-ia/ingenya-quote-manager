import type { CommercialMetricsFilters } from '../types/commercialMetrics';
import { UiIcon } from './UiIcon';

interface Props {
  filters: CommercialMetricsFilters;
  responsible: string[];
  channels: string[];
  clients: { id: string; name: string; restricted: boolean }[];
  opportunities: { id: string; name: string }[];
  quotes: { id: string; name: string }[];
  onChange: (filters: CommercialMetricsFilters) => void;
}

export function MetricsFilters({
  filters,
  responsible,
  channels,
  clients,
  opportunities,
  quotes,
  onChange,
}: Props) {
  const set = <K extends keyof CommercialMetricsFilters>(
    key: K,
    value: CommercialMetricsFilters[K],
  ) => onChange({ ...filters, [key]: value });
  return (
    <section className="quote-card metrics-filters" aria-labelledby="metrics-filters-title">
      <header className="metrics-filters-heading">
        <span className="metrics-filters-icon">
          <UiIcon name="calendar" />
        </span>
        <div>
          <p className="eyebrow">Filtros</p>
          <h2 id="metrics-filters-title">Elegí la actividad que querés revisar</h2>
          <p>Ajustá el período, responsable o canal para enfocar la vista.</p>
        </div>
      </header>
      <div className="metrics-filter-core">
        <label className="field">
          <span>Desde</span>
          <input
            type="date"
            value={filters.startDate}
            onChange={(event) => set('startDate', event.target.value)}
          />
        </label>
        <label className="field">
          <span>Hasta</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(event) => set('endDate', event.target.value)}
          />
        </label>
        <label className="field">
          <span>Responsable</span>
          <select
            value={filters.responsible}
            onChange={(event) => set('responsible', event.target.value)}
          >
            <option value="all">Todos</option>
            {responsible.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Canal</span>
          <select value={filters.channel} onChange={(event) => set('channel', event.target.value)}>
            <option value="all">Todos</option>
            {channels.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>
      <details className="metrics-context-filters">
        <summary>Más filtros: cliente, obra o presupuesto</summary>
        <div className="metrics-context-filter-grid">
          <label className="field">
            <span>Cliente</span>
            <select
              value={filters.clientId}
              onChange={(event) => set('clientId', event.target.value)}
            >
              <option value="all">Todos</option>
              {clients.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.restricted ? ' · Contacto restringido' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Obra o trabajo</span>
            <select
              value={filters.opportunityId}
              onChange={(event) => set('opportunityId', event.target.value)}
            >
              <option value="all">Todas</option>
              {opportunities.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Presupuesto</span>
            <select
              value={filters.quoteId}
              onChange={(event) => set('quoteId', event.target.value)}
            >
              <option value="all">Todos</option>
              {quotes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>
    </section>
  );
}
