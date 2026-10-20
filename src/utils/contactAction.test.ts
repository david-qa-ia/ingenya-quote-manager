import { describe, expect, it } from 'vitest';
import type { FollowUpInboxItem } from '../types/followUpInbox';
import { getContactAction } from './contactAction';

const item: FollowUpInboxItem = {
  id: 'action',
  bucket: 'today',
  source: 'manual',
  clientName: 'Laura',
  responsible: 'Laura',
  contactRestricted: false,
  rescheduleCount: 0,
  priority: { score: 0, level: 'medium', reasons: [] },
};

describe('contact actions', () => {
  it('uses the normalized WhatsApp destination and never needs the result drawer', () => {
    expect(getContactAction({ ...item, channel: 'whatsapp', phone: '+54 11 3718 2246' })).toEqual({
      label: 'WhatsApp',
      href: 'https://wa.me/541137182246',
    });
  });

  it('disables actions when the contact destination is missing', () => {
    expect(getContactAction({ ...item, channel: 'call' })).toEqual({
      label: 'Llamar',
      disabledReason: 'Falta un teléfono válido.',
    });
    expect(getContactAction({ ...item, channel: 'email' })).toEqual({
      label: 'Email',
      disabledReason: 'Falta un email válido.',
    });
  });
});
