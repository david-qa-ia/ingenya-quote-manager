import type { CommercialMetrics } from '../types/commercialMetrics';
import { commercialReasonLabels } from '../utils/commercialOutcome';
export function MetricsEffectivenessTable({ metrics }: { metrics: CommercialMetrics }) {
  return (
    <section className="quote-card metrics-section" aria-labelledby="metrics-effectiveness">
      <h2 id="metrics-effectiveness">Seguimiento y motivos</h2>
      <div className="metrics-columns">
        <div>
          <h3>Seguimiento</h3>
          <table>
            <thead>
              <tr>
                <th>Grupo</th>
                <th>Completados</th>
                <th>Vencidos</th>
                <th>Reprogramados</th>
              </tr>
            </thead>
            <tbody>
              {metrics.effectiveness.map((item) => (
                <tr key={item.label}>
                  <th scope="row">{item.label}</th>
                  <td>{item.completed}</td>
                  <td>{item.overdue}</td>
                  <td>{item.rescheduled}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h3>Motivos comerciales</h3>
          {metrics.reasons.length ? (
            <ul className="metrics-reasons">
              {metrics.reasons.map((item) => (
                <li key={item.code}>
                  <span>{commercialReasonLabels[item.code]}</span>
                  <strong>{item.count}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="commercial-note">Sin motivos en el período.</p>
          )}
        </div>
      </div>
    </section>
  );
}
