import { describe, expect, it } from 'vitest';
import { buildContactMessage, buildWhatsAppUrl, toWhatsAppNumber } from './whatsappMessage';

describe('toWhatsAppNumber', () => {
  it('adds the Argentine country code that wa.me needs to open the right chat', () => {
    expect(toWhatsAppNumber('341 600-0001')).toBe('5493416000001');
    expect(toWhatsAppNumber('11 4444-5555')).toBe('5491144445555');
    expect(toWhatsAppNumber('0341 15 600-0001')).toBe('5493416000001');
    expect(toWhatsAppNumber('011 15 4444-5555')).toBe('5491144445555');
    expect(toWhatsAppNumber('02954 15 41-2345')).toBe('5492954412345');
  });

  it('keeps numbers that already have a country code', () => {
    expect(toWhatsAppNumber('+54 9 341 600-0001')).toBe('5493416000001');
    expect(toWhatsAppNumber('+54 341 600-0001')).toBe('5493416000001');
    expect(toWhatsAppNumber('5493416000001')).toBe('5493416000001');
    expect(toWhatsAppNumber('+598 99 123 456')).toBe('59899123456');
    expect(toWhatsAppNumber('0034 612 345 678')).toBe('34612345678');
  });

  it('offers no chat for a missing, pending or too short number', () => {
    expect(toWhatsAppNumber('')).toBeNull();
    expect(toWhatsAppNumber(undefined)).toBeNull();
    expect(toWhatsAppNumber('1111111111')).toBeNull();
    expect(toWhatsAppNumber('4567')).toBeNull();
  });
});

describe('buildWhatsAppUrl', () => {
  it('opens the chat with the message written and encoded', () => {
    expect(buildWhatsAppUrl('341 600-0001', 'Hola Ana, ¿cómo estás?')).toBe(
      'https://wa.me/5493416000001?text=Hola%20Ana%2C%20%C2%BFc%C3%B3mo%20est%C3%A1s%3F',
    );
    expect(buildWhatsAppUrl('341 600-0001')).toBe('https://wa.me/5493416000001');
    expect(buildWhatsAppUrl('1111111111', 'Hola')).toBeNull();
  });
});

describe('buildContactMessage', () => {
  const base = {
    contactName: 'Ana María Paz',
    service: 'Pintura de palier',
    senderName: 'Daniel',
    companyName: 'Ingenya',
  };

  it('writes greeting, who writes and why, by purpose', () => {
    expect(buildContactMessage({ ...base, purpose: 'firstContact' })).toBe(
      'Hola Ana, ¿cómo estás? Soy Daniel, de Ingenya. Te escribo por el trabajo de pintura de palier. ¿Tenés unos minutos para contarme qué necesitás?',
    );
    expect(buildContactMessage({ ...base, purpose: 'followUp' })).toBe(
      'Hola Ana, ¿cómo estás? Soy Daniel, de Ingenya. Te escribo para seguir con el trabajo de pintura de palier. ¿Cómo lo ves?',
    );
    expect(buildContactMessage({ ...base, purpose: 'quote' })).toBe(
      'Hola Ana, ¿cómo estás? Soy Daniel, de Ingenya. Te escribo por el presupuesto de pintura de palier. ¿Pudiste verlo? Cualquier duda, te la respondo.',
    );
  });

  it('leaves out what is missing instead of writing blanks', () => {
    expect(buildContactMessage({ purpose: 'followUp' })).toBe(
      'Hola, ¿cómo estás? Te escribo para seguir con lo que hablamos. ¿Cómo lo ves?',
    );
    expect(buildContactMessage({ purpose: 'quote', companyName: 'Ingenya', service: 'AFIP' })).toBe(
      'Hola, ¿cómo estás? Soy de Ingenya. Te escribo por el presupuesto de AFIP. ¿Pudiste verlo? Cualquier duda, te la respondo.',
    );
  });
});
