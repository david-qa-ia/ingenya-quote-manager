import type { ResultNextStep } from '../components/RegisterResultDrawer';

/** Labels of the next steps, also stored as the prospect's next action (SCRUM-117). */
export const resultNextStepLabels: Record<ResultNextStep, string> = {
  call: 'Llamar',
  sendQuote: 'Enviar presupuesto',
  email: 'Enviar email',
  whatsapp: 'Enviar WhatsApp',
  instagram: 'Enviar Instagram',
  meeting: 'Reunión',
  none: 'Sin próximo paso',
};
