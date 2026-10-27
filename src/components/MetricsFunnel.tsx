import type { CommercialMetrics } from '../types/commercialMetrics';

export function MetricsFunnel({ metrics }: { metrics: CommercialMetrics }) {
  return (
    <section className="quote-card metrics-section" aria-labelledby="metrics-funnel">
      <h2 id="metrics-funnel">Resumen de actividad</h2>
      <dl className="metrics-funnel">
        <div>
          <dt>Acciones registradas</dt>
          <dd>{metrics.kpis.activitiesRegistered.value}</dd>
        </div>
        <div>
          <dt>Contactos efectivos</dt>
          <dd>{metrics.kpis.effectiveContacts.value}</dd>
        </div>
        <div>
          <dt>Notas agregadas</dt>
          <dd>{metrics.kpis.notesAdded.value}</dd>
        </div>
        <div>
          <dt>Presupuestos enviados</dt>
          <dd>{metrics.kpis.quotesSent.value}</dd>
        </div>
        <div>
          <dt>Seguimientos completados</dt>
          <dd>{metrics.kpis.followUpsCompleted.value}</dd>
        </div>
      </dl>
    </section>
  );
}
