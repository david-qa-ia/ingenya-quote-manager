import type { FollowUpInboxItem } from '../types/followUpInbox';
import {
  buildContactMessage,
  buildWhatsAppUrl,
  type ContactMessagePurpose,
} from './whatsappMessage';

export type ContactAction =
  | { label: 'WhatsApp' | 'Llamar' | 'Email'; href: string }
  | { label: 'WhatsApp' | 'Llamar' | 'Email'; disabledReason: string }
  | null;

/** Who writes the WhatsApp message: the person on the team and the company. */
export interface ContactSender {
  senderName?: string;
  companyName?: string;
}

/** What the WhatsApp message of a pending action is about. */
export function getInboxMessagePurpose(item: FollowUpInboxItem): ContactMessagePurpose {
  if (item.quoteId) return 'quote';
  return item.firstContact ? 'firstContact' : 'followUp';
}

export function getContactAction(
  item: FollowUpInboxItem,
  sender: ContactSender = {},
): ContactAction {
  const phone = item.phone?.replace(/\D/g, '');
  if (item.channel === 'whatsapp') {
    const href = buildWhatsAppUrl(
      item.phone,
      buildContactMessage({
        ...sender,
        purpose: getInboxMessagePurpose(item),
        contactName: item.clientName,
        // A quote without project name is named by its internal number: not for the client.
        service:
          item.quoteName && item.quoteName !== item.quoteId ? item.quoteName : item.opportunityName,
      }),
    );
    return href
      ? { label: 'WhatsApp', href }
      : { label: 'WhatsApp', disabledReason: 'Falta un teléfono válido.' };
  }
  if (item.channel === 'call')
    return phone
      ? { label: 'Llamar', href: `tel:${phone}` }
      : { label: 'Llamar', disabledReason: 'Falta un teléfono válido.' };
  if (item.channel === 'email')
    return item.email
      ? { label: 'Email', href: `mailto:${item.email}` }
      : { label: 'Email', disabledReason: 'Falta un email válido.' };
  return null;
}
