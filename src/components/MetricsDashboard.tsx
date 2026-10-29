import { useMemo, useState } from 'react';
import type { CommercialMetricsSources } from '../types/commercialMetrics';
import { defaultCommercialMetricsFilters } from '../types/commercialMetrics';
import {
  calculateCommercialMetrics,
  getArgentinaToday,
  PROSPECT_FILTER_PREFIX,
} from '../utils/commercialMetrics';
import { MetricsActivityFocus } from './MetricsActivityFocus';
import { MetricsEffectivenessTable } from './MetricsEffectivenessTable';
import { MetricsFilters } from './MetricsFilters';
import { MetricsKpiCards } from './MetricsKpiCards';
import { MetricsTrend } from './MetricsTrend';

export function MetricsDashboard({ sources }: { sources: CommercialMetricsSources }) {
  const today = getArgentinaToday();
  const [filters, setFilters] = useState({
    ...defaultCommercialMetricsFilters,
    startDate: today,
    endDate: today,
  });
  const metrics = useMemo(() => calculateCommercialMetrics(sources, filters), [sources, filters]);
  const prospects = sources.prospects ?? [];
  const responsible = [
    ...new Set(
      [
        ...sources.activities.map((item) => item.author),
        ...sources.quotes.flatMap((item) => [item.sentAudit?.changedBy ?? '']),
        ...prospects.flatMap((item) => item.activities.map((activity) => activity.author ?? '')),
        ...sources.opportunities.flatMap((item) =>
          item.nextAction ? item.nextAction.history.map((entry) => entry.actor) : [],
        ),
      ].filter(Boolean),
    ),
  ].sort();
  const channels = [
    ...new Set([
      ...sources.activities.map((item) => item.type),
      ...sources.opportunities.flatMap((item) => (item.nextAction ? [item.nextAction.type] : [])),
      ...prospects.flatMap((item) =>
        item.activities.flatMap((activity) =>
          activity.channel ? [activity.channel === 'phone' ? 'call' : activity.channel] : [],
        ),
      ),
    ]),
  ].sort();
  const recoveryError =
    sources.issues.some((issue) => issue === 'invalid-root' || issue === 'unavailable') &&
    sources.opportunities.length === 0 &&
    sources.quotes.length === 0 &&
    sources.activities.length === 0 &&
    sources.executions.length === 0 &&
    sources.outcomes.length === 0;
  return (
    <main className="app-shell metrics-dashboard">
      <header className="saved-quotes-header">
        <div>
          <p className="eyebrow">Actividad comercial</p>
          <h1>Mi actividad</h1>
          <p className="page-description">
            Lo que registraste y avanzaste en el período. Para ver el estado de cada oportunidad,
            usá Seguimiento.
          </p>
        </div>
      </header>
      <MetricsFilters
        filters={filters}
        onChange={setFilters}
        responsible={responsible}
        channels={channels}
        clients={[
          ...sources.clients.map((item) => ({
            id: item.id,
            name: item.name,
            restricted: Boolean(item.doNotContact),
          })),
          // Converted prospects are measured through their client and opportunity.
          ...prospects
            .filter((item) => item.conversion?.state !== 'completed')
            .map((item) => ({
              id: `${PROSPECT_FILTER_PREFIX}${item.id}`,
              name: `${item.name} · Prospecto`,
              restricted: false,
            })),
        ]}
        opportunities={sources.opportunities.map((item) => ({ id: item.id, name: item.name }))}
        quotes={sources.quotes.map((item) => ({ id: item.id, name: item.projectName || item.id }))}
      />
      {recoveryError && (
        <p className="commercial-warning" role="alert">
          No se pudieron recuperar los datos necesarios para calcular métricas. Los registros
          locales no fueron modificados.
        </p>
      )}
      {metrics.partialCoverage && !recoveryError && (
        <p className="commercial-warning" role="alert">
          Cobertura parcial: algunos registros históricos, asociaciones o datos recuperados no están
          disponibles.
        </p>
      )}
      {metrics.empty ? (
        <section className="empty-state">
          <h2>No registraste actividad con estos filtros</h2>
          <p>Probá otro período o una combinación de filtros más amplia.</p>
        </section>
      ) : (
        <>
          <MetricsActivityFocus metrics={metrics} />
          <MetricsKpiCards metrics={metrics} />
          <details className="metrics-traceability">
            <summary>Ver trazabilidad del período</summary>
            <MetricsTrend metrics={metrics} />
            <MetricsEffectivenessTable metrics={metrics} />
          </details>
        </>
      )}
    </main>
  );
}
