import type { CommercialMetrics } from '../types/commercialMetrics';
import { UiIcon, type UiIconName } from './UiIcon';

const content = {
  registerContact: {
    icon: 'phone',
    title: 'Empezá por registrar un contacto',
    description:
      'Todavía no hay llamadas, WhatsApps ni emails registrados en este período. Elegí una oportunidad desde Seguimiento y dejá asentado el resultado.',
  },
  followUpContacts: {
    icon: 'activity',
    title: 'Retomá los contactos que no avanzaron',
    description:
      'Ya registraste contactos, pero ninguno quedó marcado como efectivo. Revisá sus resultados y definí el siguiente paso.',
  },
  defineNextStep: {
    icon: 'calendar',
    title: 'Convertí el contacto en un próximo paso',
    description:
      'Tuviste contacto efectivo, pero todavía no completaste un seguimiento. Agendá o registrá la acción que mueve la oportunidad.',
  },
  keepMomentum: {
    icon: 'check-circle',
    title: 'Mantené el ritmo',
    description:
      'Ya registraste contactos efectivos y seguimientos completados. Mirá Seguimiento para elegir la próxima oportunidad a trabajar.',
  },
} as const satisfies Record<
  CommercialMetrics['focus'],
  { icon: UiIconName; title: string; description: string }
>;

export function MetricsActivityFocus({ metrics }: { metrics: CommercialMetrics }) {
  const item = content[metrics.focus];
  return (
    <section className="metrics-focus-card" aria-labelledby="metrics-focus-title">
      <span className="metrics-focus-icon">
        <UiIcon name={item.icon} />
      </span>
      <div className="metrics-focus-content">
        <p className="eyebrow">Tu próximo foco</p>
        <h2 id="metrics-focus-title">{item.title}</h2>
        <p>{item.description}</p>
      </div>
    </section>
  );
}
