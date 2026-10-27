import type { CommercialMetrics } from '../types/commercialMetrics';
export function MetricsEffectivenessTable({ metrics }: { metrics: CommercialMetrics }) {
  return (
    <section className="quote-card metrics-section" aria-labelledby="metrics-effectiveness">
      <h2 id="metrics-effectiveness">Detalle de tu actividad</h2>
      <div className="metrics-columns">
        <div>
          <h3>Acciones registradas</h3>
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {metrics.activityBreakdown.map((item) => (
                <tr key={item.label}>
                  <th scope="row">{item.label}</th>
                  <td>{item.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h3>Seguimientos trabajados</h3>
          <dl className="metrics-reasons">
            <div>
              <dt>Completados</dt>
              <dd>{metrics.followUpActions.completed}</dd>
            </div>
            <div>
              <dt>Reprogramados</dt>
              <dd>{metrics.followUpActions.rescheduled}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
