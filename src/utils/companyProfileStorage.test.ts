import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  companyProfileToBrand,
  defaultCompanyProfile,
  getCompanyProfileFieldErrors,
  hasStoredCompanyProfile,
  loadCompanyProfile,
  normalizeCompanyProfile,
  saveCompanyProfile,
} from './companyProfileStorage';

const stored = new Map<string, string>();

describe('company profile (SCRUM-119)', () => {
  beforeEach(() => {
    stored.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
      removeItem: (key: string) => stored.delete(key),
    });
    vi.stubGlobal('sessionStorage', { getItem: () => null });
  });

  it("uses Ventro's data until the workspace saves its own", () => {
    expect(hasStoredCompanyProfile()).toBe(false);
    expect(loadCompanyProfile()).toMatchObject({
      companyName: 'Ventro',
      email: 'david@somosventro.com',
      website: 'www.somosventro.com',
      quoteValidityDays: 15,
    });
    expect(defaultCompanyProfile.whatsapp.replace(/\D/g, '')).toBe('3417793657');
  });

  it('keeps the data another company saves for its workspace', () => {
    const alefTau = normalizeCompanyProfile({
      companyName: 'Alef-Tau',
      email: 'contacto@aleftau.com',
      whatsapp: '341 616-4761',
      footerText: 'Alef-Tau - Construcciones',
      quoteValidityDays: 30,
    })!;
    saveCompanyProfile(alefTau);
    expect(loadCompanyProfile()).toEqual(alefTau);
    expect(companyProfileToBrand(alefTau)).toMatchObject({
      companyName: 'Alef-Tau',
      whatsapp: { display: '341 616-4761', value: '3416164761' },
      quoteValidityDays: 30,
    });
  });

  it('validates the form and falls back to the company name in the footer', () => {
    expect(
      getCompanyProfileFieldErrors({
        ...defaultCompanyProfile,
        companyName: ' ',
        email: 'x@',
        whatsapp: '12',
        quoteValidityDays: '0',
      }),
    ).toEqual({
      companyName: 'Ingresá el nombre de la empresa.',
      email: 'Ingresá un email válido, por ejemplo nombre@empresa.com.',
      whatsapp: 'El WhatsApp debe tener entre 7 y 15 dígitos.',
      quoteValidityDays: 'Elegí una validez de 1 a 365 días.',
    });
    expect(
      companyProfileToBrand({ ...defaultCompanyProfile, footerText: '' }).footerBusinessText,
    ).toBe('Ventro');
    expect(normalizeCompanyProfile({ companyName: '' })).toBeNull();
  });
});
