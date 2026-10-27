import type { CommercialMetrics } from '../types/commercialMetrics';
export function MetricsTrend({ metrics }: { metrics: CommercialMetrics }) {
  return (
    <section className="quote-card metrics-section" aria-labelledby="metrics-trend">
      <header className="metrics-section-heading">
        <div>
          <h2 id="metrics-trend">Actividad por día</h2>
          <p>Lo que registraste en cada jornada del período seleccionado.</p>
        </div>
      </header>
      {metrics.trend.length === 0 ? (
        <p className="commercial-note">No hay eventos en el período.</p>
      ) : (
        <div className="table-scroll metrics-trend-table">
          <table>
            <caption className="visually-hidden">Actividad registrada por día</caption>
            <thead>
              <tr>
                <th>Día</th>
                <th>Acciones</th>
                <th>Contactos</th>
                <th>Efectivos</th>
                <th>Notas</th>
                <th>Enviados</th>
              </tr>
            </thead>
            <tbody>
              {metrics.trend.map((item) => (
                <tr key={item.day}>
                  <th scope="row">{item.label}</th>
                  <td>{item.activities}</td>
                  <td>{item.contacts}</td>
                  <td>{item.effectiveContacts}</td>
                  <td>{item.notes}</td>
                  <td>{item.sent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
