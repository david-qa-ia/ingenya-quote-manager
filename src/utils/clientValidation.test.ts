import { describe, expect, it } from 'vitest';
import {
  canContactClient,
  getClientValidationError,
  isClient,
  normalizeClientInput,
} from './clientValidation';
import type { ClientInput } from '../types/client';

const input: ClientInput = {
  name: 'Ana',
  phone: '+54 9 341 555-0101',
  email: 'ana@example.com',
  preferredChannel: '',
  contactConsent: false,
};

describe('client validation', () => {
  it('accepts real contacts and every approved preferred channel', () => {
    for (const preferredChannel of ['', 'phone', 'whatsapp', 'email'] as const) {
      expect(getClientValidationError({ ...input, preferredChannel })).toBeNull();
    }
  });
  it.each([
    { name: ' ' },
    { phone: '' },
    { phone: '123' },
    { phone: 'abcdefghij' },
    { phone: '1234567890123456' },
    { email: '' },
    { email: 'invalid' },
  ])('requires a valid name and both contacts: %o', (invalid) => {
    expect(getClientValidationError({ ...input, ...invalid })).not.toBeNull();
  });
  it('normalizes pending values and never treats them as usable contacts even with consent', () => {
    const pending = normalizeClientInput({
      ...input,
      name: ' Ana ',
      phone: '111-111-1111',
      email: ' NONE ',
      contactConsent: true,
    });
    expect(pending).toMatchObject({ name: 'Ana', phone: '1111111111', email: 'none' });
    expect(getClientValidationError(pending)).toBeNull();
    for (const channel of ['phone', 'whatsapp', 'email'] as const)
      expect(canContactClient(pending, channel)).toBe(false);
  });
  it('requires consent and evaluates the chosen real channel independently of the pending one', () => {
    expect(canContactClient(input, 'email')).toBe(false);
    expect(canContactClient({ ...input, contactConsent: true, phone: '1111111111' }, 'email')).toBe(
      true,
    );
    expect(canContactClient({ ...input, contactConsent: true, email: 'none' }, 'whatsapp')).toBe(
      true,
    );
  });
  it('rejects untrusted records with missing consent, invalid channels or dates', () => {
    const client = {
      ...input,
      id: 'client',
      createdAt: '2026-10-14T00:00:00Z',
      updatedAt: '2026-10-14T00:00:00Z',
    };
    expect(isClient(client)).toBe(true);
    for (const invalid of [
      null,
      [],
      { ...client, contactConsent: undefined },
      { ...client, preferredChannel: 'sms' },
      { ...client, updatedAt: 'invalid' },
      { ...client, phone: 123 },
    ])
      expect(isClient(invalid)).toBe(false);
  });
});
