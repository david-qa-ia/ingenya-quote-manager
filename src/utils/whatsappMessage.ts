import { isPendingPhone } from './clientValidation';

/**
 * WhatsApp links with the message ready. The app only opens the chat with the text written; the
 * user reviews it and presses send (it never sends by itself).
 */

/**
 * The number as WhatsApp needs it: country code included. Numbers are stored as typed, usually
 * Argentine without country code ("341 600-0001", "0341 15 600-0001"); wa.me only opens the right
 * chat for those as 549 + area code + number. A number typed with "+" or "00" keeps its own
 * country code. Returns null for a missing, pending or too short number.
 */
export function toWhatsAppNumber(phone: string | undefined): string | null {
  const typed = phone?.trim() ?? '';
  let digits = typed.replace(/\D/g, '');
  if (!digits || isPendingPhone(digits)) return null;
  if (typed.startsWith('+') || typed.startsWith('00')) {
    digits = digits.replace(/^00/, '');
    if (/^54[1-8]\d{9}$/.test(digits)) return `549${digits.slice(2)}`;
    return digits.length >= 8 ? digits : null;
  }
  if (/^549\d{10}$/.test(digits)) return digits;
  if (/^54\d{10}$/.test(digits)) return `549${digits.slice(2)}`;
  digits = digits.replace(/^0/, '');
  if (digits.length === 12) digits = withoutMobilePrefix(digits);
  if (digits.length === 10) return `549${digits}`;
  return digits.length >= 8 ? digits : null;
}

/** "341 15 6000001" → "3416000001": the 15 after the area code is not dialed from WhatsApp. */
function withoutMobilePrefix(digits: string): string {
  const areaLength = digits.startsWith('11') ? 2 : digits.slice(3, 5) === '15' ? 3 : 4;
  return digits.slice(areaLength, areaLength + 2) === '15'
    ? digits.slice(0, areaLength) + digits.slice(areaLength + 2)
    : digits;
}

/** Opens a WhatsApp chat with `message` already written, or null without a usable number. */
export function buildWhatsAppUrl(phone: string | undefined, message = ''): string | null {
  const number = toWhatsAppNumber(phone);
  if (!number) return null;
  const text = message.trim();
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export type ContactMessagePurpose = 'firstContact' | 'followUp' | 'quote';

export interface ContactMessageInput {
  purpose: ContactMessagePurpose;
  /** The person written to; only the first name is used. */
  contactName?: string;
  service?: string;
  /** Who writes: the person on the team. */
  senderName?: string;
  companyName?: string;
}

/**
 * The message a WhatsApp button writes: greeting, who writes and why, ready to send or edit in
 * the chat. Short on purpose; anything missing (name, service, company) is left out.
 */
export function buildContactMessage(input: ContactMessageInput): string {
  const firstName = input.contactName?.trim().split(/\s+/)[0] ?? '';
  const sender = input.senderName?.trim() ?? '';
  const company = input.companyName?.trim() ?? '';
  const service = lowerFirst(input.service?.trim() ?? '');
  const greeting = firstName ? `Hola ${firstName}, ¿cómo estás?` : 'Hola, ¿cómo estás?';
  const intro =
    sender && company
      ? `Soy ${sender}, de ${company}.`
      : sender || company
        ? `Soy ${sender || `de ${company}`}.`
        : '';
  const reason = {
    firstContact: service
      ? `Te escribo por el trabajo de ${service}. ¿Tenés unos minutos para contarme qué necesitás?`
      : 'Te escribo por tu consulta. ¿Tenés unos minutos para contarme qué necesitás?',
    followUp: service
      ? `Te escribo para seguir con el trabajo de ${service}. ¿Cómo lo ves?`
      : 'Te escribo para seguir con lo que hablamos. ¿Cómo lo ves?',
    quote: service
      ? `Te escribo por el presupuesto de ${service}. ¿Pudiste verlo? Cualquier duda, te la respondo.`
      : 'Te escribo por el presupuesto. ¿Pudiste verlo? Cualquier duda, te la respondo.',
  }[input.purpose];
  return [greeting, intro, reason].filter(Boolean).join(' ');
}

/** "Pintura de palier" → "pintura de palier", but "AFIP" and "IPS Sur" stay as typed. */
function lowerFirst(text: string): string {
  return /^\p{Lu}\p{Ll}/u.test(text) ? text[0].toLocaleLowerCase('es') + text.slice(1) : text;
}
