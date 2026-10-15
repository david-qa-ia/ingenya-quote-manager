import type { CommercialMetrics } from '../types/commercialMetrics';
export function MetricsTrend({ metrics }: { metrics: CommercialMetrics }) {
  return (
    <section className="quote-card metrics-section" aria-labelledby="metrics-trend">
      <h2 id="metrics-trend">Evolución temporal</h2>
      {metrics.trend.length === 0 ? (
        <p className="commercial-note">No hay eventos en el período.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <caption className="visually-hidden">
              Evolución diaria de obras o trabajos y presupuestos
            </caption>
            <thead>
              <tr>
                <th>Día</th>
                <th>Creadas</th>
                <th>Enviados</th>
                <th>Aceptados</th>
                <th>Rechazados</th>
                <th>Perdidas</th>
              </tr>
            </thead>
            <tbody>
              {metrics.trend.map((item) => (
                <tr key={item.day}>
                  <th scope="row">{item.label}</th>
                  <td>{item.created}</td>
                  <td>{item.sent}</td>
                  <td>{item.accepted}</td>
                  <td>{item.rejected}</td>
                  <td>{item.lost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
