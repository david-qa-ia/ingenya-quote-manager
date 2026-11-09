import type { ResultChannel, ResultNextStep } from '../components/RegisterResultDrawer';
import { businessTimeZone } from './opportunityNextAction';

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

/**
 * Results that close the conversation: the person is not interested or cannot be reached with
 * that data. Registering them does not ask for a next step (it stays optional).
 */
export function isDiscardResult(result: string): boolean {
  return result === 'notInterested' || result === 'invalidNumber';
}

export interface NextStepSuggestion {
  nextStep: ResultNextStep;
  /** Value for a datetime-local field, in Argentina time: a working day at 10:00. */
  dueAt: string;
  /** Short reason shown under the suggestion. */
  reason: string;
}

export interface NextStepSuggestionInput {
  result: string;
  channel: ResultChannel;
  /** True when the job already has a quote: the conversation is about that quote. */
  hasQuote: boolean;
  /** Steps that cannot be used (no phone, no email…). */
  isUnavailable?: (step: ResultNextStep) => boolean;
  now?: Date;
}

/**
 * The next step offered after a result, which the user can change:
 * - no answer: try again the next working day, by the same channel;
 * - contacted or interested, without a quote: send the quote (interested: sooner);
 * - contacted or interested, with a quote: follow it up in three working days;
 * - not interested or wrong data: nothing; the next step is optional.
 * Meetings are followed up by phone. An unavailable channel falls back to call, WhatsApp or
 * email, in that order.
 */
export function suggestNextStep(input: NextStepSuggestionInput): NextStepSuggestion | null {
  const now = input.now ?? new Date();
  const sameChannel: ResultNextStep = input.channel === 'meeting' ? 'call' : input.channel;
  let plan: { step: ResultNextStep; days: number; reason: string } | null = null;
  if (input.result === 'noAnswer')
    plan = { step: sameChannel, days: 1, reason: 'No respondió: volvé a intentar mañana.' };
  else if (input.result === 'effectiveContact' || input.result === 'interested')
    plan = input.hasQuote
      ? { step: sameChannel, days: 3, reason: 'Seguimiento del presupuesto en tres días.' }
      : {
          step: 'sendQuote',
          days: input.result === 'interested' ? 1 : 2,
          reason:
            input.result === 'interested'
              ? 'Le interesa: el paso que sigue es el presupuesto.'
              : 'Hubo contacto: el paso que sigue es el presupuesto.',
        };
  if (!plan) return null;
  const unavailable = input.isUnavailable ?? (() => false);
  const step = [plan.step, 'call', 'whatsapp', 'email'].find(
    (candidate) => !unavailable(candidate as ResultNextStep),
  ) as ResultNextStep | undefined;
  if (!step) return null;
  return { nextStep: step, dueAt: `${addWorkingDays(now, plan.days)}T10:00`, reason: plan.reason };
}

/** The day `days` working days after `now`, as YYYY-MM-DD in Argentina. */
function addWorkingDays(now: Date, days: number): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: businessTimeZone }).format(now);
  const date = new Date(`${today}T12:00:00Z`);
  let left = days;
  while (left > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) left -= 1;
  }
  return date.toISOString().slice(0, 10);
}
