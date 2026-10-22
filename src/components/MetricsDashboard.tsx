import { useMemo, useState } from 'react';
import type { CommercialMetricsSources } from '../types/commercialMetrics';
import { defaultCommercialMetricsFilters } from '../types/commercialMetrics';
import { calculateCommercialMetrics, getArgentinaToday } from '../utils/commercialMetrics';
import { MetricsEffectivenessTable } from './MetricsEffectivenessTable';
import { MetricsFilters } from './MetricsFilters';
import { MetricsFunnel } from './MetricsFunnel';
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
  const responsible = [
    ...new Set(sources.opportunities.map((item) => item.responsibleSeller).filter(Boolean)),
  ].sort();
  const services = [
    ...new Set(sources.quotes.flatMap((item) => item.lines.map((line) => line.name))),
  ].sort((a, b) => a.localeCompare(b, 'es'));
  const channels = [
    ...new Set([
      ...sources.activities.map((item) => item.type),
      ...sources.opportunities.flatMap((item) => (item.nextAction ? [item.nextAction.type] : [])),
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
          <p className="eyebrow">Seguimiento comercial</p>
          <h1>Indicadores</h1>
          <p className="page-description">
            Vista de solo lectura calculada desde los registros disponibles.
          </p>
        </div>
      </header>
      <MetricsFilters
        filters={filters}
        onChange={setFilters}
        responsible={responsible}
        services={services}
        channels={channels}
        clients={sources.clients.map((item) => ({
          id: item.id,
          name: item.name,
          restricted: Boolean(item.doNotContact),
        }))}
        opportunities={sources.opportunities.map((item) => ({ id: item.id, name: item.name }))}
        quotes={sources.quotes.map((item) => ({ id: item.id, name: item.projectName || item.id }))}
      />
      {recoveryError && (
        <p className="commercial-warning" role="alert">
          No se pudieron recuperar los datos necesarios para calcular métricas. Los registros
          locales no fueron modificados.
        </p>
      )}
      {(metrics.partialCoverage || metrics.hasAmbiguousCorrections) && !recoveryError && (
        <p className="commercial-warning" role="alert">
          {metrics.partialCoverage
            ? 'Cobertura parcial: algunos registros históricos, asociaciones o datos recuperados no están disponibles.'
            : ''}
          {metrics.partialCoverage && metrics.hasAmbiguousCorrections ? ' ' : ''}
          {metrics.hasAmbiguousCorrections
            ? 'Hay correcciones comerciales ambiguas; no se inventan resultados sustitutos.'
            : ''}
        </p>
      )}
      {metrics.empty ? (
        <section className="empty-state">
          <h2>No hay métricas para los filtros elegidos</h2>
          <p>Probá otro período o una combinación de filtros más amplia.</p>
        </section>
      ) : (
        <>
          <MetricsKpiCards metrics={metrics} />
          <MetricsFunnel metrics={metrics} />
          <section className="metrics-time">
            <article>
              <h2>Tiempo hasta primer contacto</h2>
              <p>
                {metrics.averageFirstContactHours === null
                  ? 'Sin datos suficientes'
                  : `${metrics.averageFirstContactHours.toFixed(1)} horas promedio`}
              </p>
            </article>
            <article>
              <h2>Tiempo hasta resultado</h2>
              <p>
                {metrics.averageResultHours === null
                  ? 'Sin datos suficientes'
                  : `${metrics.averageResultHours.toFixed(1)} horas promedio`}
              </p>
            </article>
          </section>
          <MetricsTrend metrics={metrics} />
          <MetricsEffectivenessTable metrics={metrics} />
        </>
      )}
    </main>
  );
}
