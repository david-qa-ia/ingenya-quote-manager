import type { CommercialMetrics, MetricValue } from '../types/commercialMetrics';
import { UiIcon, type UiIconName } from './UiIcon';

const comparisonText = (metric: MetricValue) =>
  metric.comparison === null
    ? 'Sin comparación'
    : `${metric.comparison >= 0 ? '+' : ''}${metric.comparison.toFixed(0)}% vs. período anterior`;

export function MetricsKpiCards({ metrics }: { metrics: CommercialMetrics }) {
  const items = [
    {
      label: 'Contactos registrados',
      icon: 'phone',
      metric: metrics.kpis.contactsRegistered,
    },
    {
      label: 'Contactos efectivos',
      icon: 'check-circle',
      metric: metrics.kpis.effectiveContacts,
      detail: `${metrics.contactEffectiveness.effective} de ${metrics.contactEffectiveness.registered} contactos avanzaron`,
    },
    { label: 'Presupuestos enviados', icon: 'document', metric: metrics.kpis.quotesSent },
    {
      label: 'Seguimientos completados',
      icon: 'calendar-check',
      metric: metrics.kpis.followUpsCompleted,
    },
  ] satisfies { label: string; icon: UiIconName; metric: MetricValue; detail?: string }[];
  return (
    <section className="metrics-kpis" aria-label="Indicadores clave">
      {items.map(({ label, icon, metric, detail }) => (
        <article className="metrics-kpi-card" key={label}>
          <div className="metrics-kpi-heading">
            <span className="metrics-kpi-icon">
              <UiIcon name={icon} />
            </span>
            <span>{label}</span>
          </div>
          <strong>{metric.value}</strong>
          <small>{detail ?? comparisonText(metric)}</small>
        </article>
      ))}
    </section>
  );
}
