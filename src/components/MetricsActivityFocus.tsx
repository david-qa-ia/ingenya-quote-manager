import type { CommercialMetrics } from '../types/commercialMetrics';

const content = {
  registerContact: {
    title: 'Empezá por registrar un contacto',
    description:
      'Todavía no hay llamadas, WhatsApps ni emails registrados en este período. Elegí una oportunidad desde Seguimiento y dejá asentado el resultado.',
  },
  followUpContacts: {
    title: 'Retomá los contactos que no avanzaron',
    description:
      'Ya registraste contactos, pero ninguno quedó marcado como efectivo. Revisá sus resultados y definí el siguiente paso.',
  },
  defineNextStep: {
    title: 'Convertí el contacto en un próximo paso',
    description:
      'Tuviste contacto efectivo, pero todavía no completaste un seguimiento. Agendá o registrá la acción que mueve la oportunidad.',
  },
  keepMomentum: {
    title: 'Mantené el ritmo',
    description:
      'Ya registraste contactos efectivos y seguimientos completados. Mirá Seguimiento para elegir la próxima oportunidad a trabajar.',
  },
} as const;

export function MetricsActivityFocus({ metrics }: { metrics: CommercialMetrics }) {
  const item = content[metrics.focus];
  return (
    <section className="metrics-focus-card" aria-labelledby="metrics-focus-title">
      <p className="eyebrow">Tu próximo foco</p>
      <div>
        <h2 id="metrics-focus-title">{item.title}</h2>
        <p>{item.description}</p>
      </div>
    </section>
  );
}
