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
  it('opens the WhatsApp chat with the country code and the message ready', () => {
    const action = getContactAction(
      {
        ...item,
        channel: 'whatsapp',
        phone: '+54 11 3718 2246',
        subjectType: 'prospect',
        firstContact: true,
        opportunityName: 'Impermeabilización',
      },
      { senderName: 'Daniel', companyName: 'Ingenya' },
    );

    expect(action).toEqual({
      label: 'WhatsApp',
      href: `https://wa.me/5491137182246?text=${encodeURIComponent(
        'Hola Laura, ¿cómo estás? Soy Daniel, de Ingenya. Te escribo por el trabajo de impermeabilización. ¿Tenés unos minutos para contarme qué necesitás?',
      )}`,
    });
  });

  it('writes about the quote, never naming it by its internal number', () => {
    const action = getContactAction({
      ...item,
      channel: 'whatsapp',
      phone: '341 600-0001',
      quoteId: 'PRES-2026-ABCD1234',
      quoteName: 'PRES-2026-ABCD1234',
      opportunityName: 'Pintura palier',
    });

    expect(action && 'href' in action && decodeURIComponent(action.href)).toContain(
      'Te escribo por el presupuesto de pintura palier.',
    );
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
