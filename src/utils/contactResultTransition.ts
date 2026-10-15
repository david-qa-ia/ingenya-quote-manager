import type { ContactChannel, WhatsAppResult } from '../types/contactScript';
import type { CallResult } from '../types/activity';

export type ContactActionTransition = 'completed' | 'rescheduled' | 'cancelled' | 'none';

export function getContactActionTransition(
  channel: ContactChannel,
  result: CallResult | WhatsAppResult,
): ContactActionTransition {
  if (channel === 'call') {
    if (result === 'effectiveContact') return 'completed';
    if (result === 'callBack') return 'rescheduled';
    if (result === 'notInterested') return 'cancelled';
    return 'none';
  }
  if (result === 'responseReceived') return 'completed';
  if (result === 'notInterested') return 'cancelled';
  return 'none';
}
