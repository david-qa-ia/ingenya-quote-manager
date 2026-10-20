import type { FollowUpInboxItem } from '../types/followUpInbox';

export type ContactAction =
  | { label: 'WhatsApp' | 'Llamar' | 'Email'; href: string }
  | { label: 'WhatsApp' | 'Llamar' | 'Email'; disabledReason: string }
  | null;

export function getContactAction(item: FollowUpInboxItem): ContactAction {
  const phone = item.phone?.replace(/\D/g, '');
  if (item.channel === 'whatsapp')
    return phone
      ? { label: 'WhatsApp', href: `https://wa.me/${phone}` }
      : { label: 'WhatsApp', disabledReason: 'Falta un teléfono válido.' };
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
