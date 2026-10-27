import type { CommercialMetrics } from '../types/commercialMetrics';
import { UiIcon, type UiIconName } from './UiIcon';

const breakdownIcons: Record<string, UiIconName> = {
  Llamadas: 'phone',
  WhatsApp: 'whatsapp',
  Emails: 'email',
  Notas: 'note',
};

export function MetricsEffectivenessTable({ metrics }: { metrics: CommercialMetrics }) {
  return (
    <section className="quote-card metrics-section" aria-labelledby="metrics-effectiveness">
      <header className="metrics-section-heading">
        <div>
          <h2 id="metrics-effectiveness">Detalle registrado</h2>
          <p>Desglose de acciones y seguimientos que cargaste en este período.</p>
        </div>
      </header>
      <div className="metrics-detail-grid">
        <section className="metrics-detail-panel" aria-labelledby="metrics-activity-breakdown">
          <h3 id="metrics-activity-breakdown">Acciones</h3>
          <ul className="metrics-breakdown-list">
            {metrics.activityBreakdown.map((item) => (
              <li key={item.label}>
                <span>
                  <UiIcon name={breakdownIcons[item.label]} />
                  {item.label}
                </span>
                <strong>{item.count}</strong>
              </li>
            ))}
          </ul>
        </section>
        <section className="metrics-detail-panel" aria-labelledby="metrics-follow-up-breakdown">
          <h3 id="metrics-follow-up-breakdown">Seguimientos</h3>
          <dl className="metrics-follow-up-list">
            <div>
              <dt>
                <UiIcon name="check-circle" />
                Completados
              </dt>
              <dd>{metrics.followUpActions.completed}</dd>
            </div>
            <div>
              <dt>
                <UiIcon name="calendar" />
                Reprogramados
              </dt>
              <dd>{metrics.followUpActions.rescheduled}</dd>
            </div>
          </dl>
        </section>
      </div>
    </section>
  );
}
