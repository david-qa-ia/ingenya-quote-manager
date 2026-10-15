import type { CommercialMetricsFilters } from '../types/commercialMetrics';

interface Props {
  filters: CommercialMetricsFilters;
  responsible: string[];
  services: string[];
  channels: string[];
  clients: { id: string; name: string; restricted: boolean }[];
  opportunities: { id: string; name: string }[];
  quotes: { id: string; name: string }[];
  onChange: (filters: CommercialMetricsFilters) => void;
}

export function MetricsFilters({
  filters,
  responsible,
  services,
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
    <section className="quote-card metrics-filters" aria-label="Filtros de métricas">
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
        <span>Servicio</span>
        <select value={filters.service} onChange={(event) => set('service', event.target.value)}>
          <option value="all">Todos</option>
          {services.map((item) => (
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
      <label className="field">
        <span>Estado comercial</span>
        <select
          value={filters.commercialState}
          onChange={(event) =>
            set(
              'commercialState',
              event.target.value as CommercialMetricsFilters['commercialState'],
            )
          }
        >
          <option value="all">Todos</option>
          <option value="open">Abierta</option>
          <option value="won">Ganada</option>
          <option value="lost">Perdida</option>
        </select>
      </label>
      <label className="field">
        <span>Motivo</span>
        <select
          value={filters.reason}
          onChange={(event) =>
            set('reason', event.target.value as CommercialMetricsFilters['reason'])
          }
        >
          <option value="all">Todos</option>
          <option value="price">Precio</option>
          <option value="noResponse">Falta de respuesta</option>
          <option value="choseAnotherProposal">Otra propuesta</option>
          <option value="outOfScope">Fuera de alcance</option>
          <option value="noBudget">Sin presupuesto</option>
          <option value="timeline">Plazo</option>
          <option value="invalidData">Datos inválidos</option>
          <option value="notInterested">No interesado</option>
          <option value="duplicate">Duplicado</option>
          <option value="other">Otro</option>
        </select>
      </label>
      <label className="field">
        <span>Cliente</span>
        <select value={filters.clientId} onChange={(event) => set('clientId', event.target.value)}>
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
        <span>Oportunidad</span>
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
        <select value={filters.quoteId} onChange={(event) => set('quoteId', event.target.value)}>
          <option value="all">Todos</option>
          {quotes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
