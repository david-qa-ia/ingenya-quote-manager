import type { CommercialMetrics, MetricValue } from '../types/commercialMetrics';

const comparisonText = (metric: MetricValue) =>
  metric.comparison === null
    ? 'Sin comparación'
    : `${metric.comparison >= 0 ? '+' : ''}${metric.comparison.toFixed(0)}% vs. período anterior`;

export function MetricsKpiCards({ metrics }: { metrics: CommercialMetrics }) {
  const items = [
    { label: 'Contactos registrados', metric: metrics.kpis.contactsRegistered },
    {
      label: 'Contactos efectivos',
      metric: metrics.kpis.effectiveContacts,
      detail: `${metrics.contactEffectiveness.effective} de ${metrics.contactEffectiveness.registered} contactos avanzaron`,
    },
    { label: 'Presupuestos enviados', metric: metrics.kpis.quotesSent },
    { label: 'Seguimientos completados', metric: metrics.kpis.followUpsCompleted },
  ];
  return (
    <section className="metrics-kpis" aria-label="Indicadores clave">
      {items.map(({ label, metric, detail }) => (
        <article className="follow-up-summary-card" key={label}>
          <span>{label}</span>
          <strong>{metric.value}</strong>
          <small>{detail ?? comparisonText(metric)}</small>
        </article>
      ))}
    </section>
  );
}
