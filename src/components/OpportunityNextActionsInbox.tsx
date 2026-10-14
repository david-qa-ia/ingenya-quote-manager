import type { Opportunity } from '../types/opportunity';
import {
  getActionBucket,
  sortOpportunitiesByAction,
  businessTimeZone,
} from '../utils/opportunityNextAction';

interface Props {
  opportunities: readonly Opportunity[];
}
const titles = {
  overdue: 'Acciones vencidas',
  today: 'Para hoy',
  upcoming: 'Próximos 7 días',
} as const;

export function OpportunityNextActionsInbox({ opportunities }: Props) {
  const now = new Date();
  const sorted = sortOpportunitiesByAction(
    opportunities.filter((opportunity) => (opportunity.status ?? 'active') === 'active'),
    now,
  );
  const groups = (Object.keys(titles) as (keyof typeof titles)[]).map(
    (bucket) =>
      [
        bucket,
        sorted.filter(
          (opportunity) =>
            opportunity.nextAction && getActionBucket(opportunity.nextAction, now) === bucket,
        ),
      ] as const,
  );
  const missing = sorted.filter(
    (opportunity) => !opportunity.nextAction || opportunity.nextAction.status !== 'pending',
  );
  return (
    <main className="app-shell">
      <header className="saved-quotes-header">
        <p className="eyebrow">Seguimiento comercial</p>
        <h1>Bandeja diaria</h1>
        <p className="page-description">
          Acciones calculadas al abrir la aplicación. No se envían mensajes automáticamente.
        </p>
      </header>
      {groups.map(([bucket, items]) => (
        <section className="quote-card inbox-section" key={bucket}>
          <h2>{titles[bucket]}</h2>
          {items.length === 0 ? (
            <p className="commercial-note">No hay acciones en este grupo.</p>
          ) : (
            <ul className="activity-list">
              {items.map((opportunity) => (
                <li key={opportunity.id}>
                  <strong>{opportunity.name}</strong>
                  <span>
                    {new Intl.DateTimeFormat('es-AR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                      timeZone: businessTimeZone,
                    }).format(new Date(opportunity.nextAction!.dueAt))}{' '}
                    · Prioridad {opportunity.nextAction!.priority}
                  </span>
                  <small>
                    {opportunity.nextAction!.description} · Responsable:{' '}
                    {opportunity.nextAction!.responsible}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <section className="quote-card inbox-section">
        <h2>Sin próxima acción</h2>
        {missing.length === 0 ? (
          <p className="commercial-note">
            Todas las oportunidades activas tienen seguimiento pendiente.
          </p>
        ) : (
          <ul className="activity-list">
            {missing.map((opportunity) => (
              <li key={opportunity.id}>
                <strong>{opportunity.name}</strong>
                <small>
                  {opportunity.noNextActionException
                    ? `Excepción justificada: ${opportunity.noNextActionException.reason}`
                    : 'Requiere programar una próxima acción.'}
                </small>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
