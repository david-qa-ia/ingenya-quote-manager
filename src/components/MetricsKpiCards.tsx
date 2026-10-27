import type { CommercialMetrics } from '../types/commercialMetrics';
const labels = {
  activitiesRegistered: 'Acciones registradas',
  contactsRegistered: 'Contactos registrados',
  effectiveContacts: 'Contactos efectivos',
  notesAdded: 'Notas agregadas',
  quotesSent: 'Presupuestos enviados',
  followUpsCompleted: 'Seguimientos completados',
  followUpsRescheduled: 'Seguimientos reprogramados',
} as const;
export function MetricsKpiCards({ metrics }: { metrics: CommercialMetrics }) {
  return (
    <section className="metrics-kpis" aria-label="Indicadores clave">
      {Object.entries(metrics.kpis).map(([key, metric]) => (
        <article className="follow-up-summary-card" key={key}>
          <span>{labels[key as keyof typeof labels]}</span>
          <strong>{metric.value}</strong>
          <small>
            {metric.comparison === null
              ? 'Sin comparación'
              : `${metric.comparison >= 0 ? '+' : ''}${metric.comparison.toFixed(0)}% vs. período anterior`}
          </small>
        </article>
      ))}
    </section>
  );
}
