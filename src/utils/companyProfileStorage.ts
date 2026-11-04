import { deploymentBrand } from '../config/deploymentBrand';
import type { DeploymentBrandConfig } from '../types/branding';
import { workspaceStorageKey } from './workspaceStorage';

/**
 * SCRUM-119: the company data printed on quotes, one per workspace. Ventro manages it for
 * itself; when another company gets the app it fills in its own data in Configuración.
 * Supabase is the source of truth when configured; this browser copy keeps the PDF working
 * offline and in local mode.
 */
export interface CompanyProfile {
  companyName: string;
  tagline: string;
  email: string;
  whatsapp: string;
  website: string;
  instagram: string;
  footerText: string;
  quoteValidityDays: number;
}

export const COMPANY_PROFILE_STORAGE_KEY = 'ingenya.companyProfile.v1';
export const COMPANY_PROFILE_VERSION_STORAGE_KEY = 'ingenya.companyProfileVersion.v1';
export const COMPANY_PROFILE_UPDATED_EVENT = 'ventro:company-profile-updated';
export const DEFAULT_QUOTE_VALIDITY_DAYS = 15;

export const defaultCompanyProfile: CompanyProfile = {
  companyName: deploymentBrand.companyName,
  tagline: deploymentBrand.experienceMessage ?? '',
  email: deploymentBrand.email,
  whatsapp: deploymentBrand.whatsapp.display,
  website: deploymentBrand.website ?? '',
  instagram: deploymentBrand.instagram ?? '',
  footerText: deploymentBrand.footerBusinessText,
  quoteValidityDays: deploymentBrand.quoteValidityDays ?? DEFAULT_QUOTE_VALIDITY_DAYS,
};

const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

/** Coerces stored or remote data into a profile; unknown or missing fields fall back to empty. */
export function normalizeCompanyProfile(value: unknown): CompanyProfile | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const companyName = text(record.companyName, 120);
  if (!companyName) return null;
  const days = Number(record.quoteValidityDays);
  return {
    companyName,
    tagline: text(record.tagline, 120),
    email: text(record.email, 160),
    whatsapp: text(record.whatsapp, 40),
    website: text(record.website, 160),
    instagram: text(record.instagram, 120),
    footerText: text(record.footerText, 160),
    quoteValidityDays:
      Number.isInteger(days) && days >= 1 && days <= 365 ? days : DEFAULT_QUOTE_VALIDITY_DAYS,
  };
}

export type CompanyProfileField = 'companyName' | 'email' | 'whatsapp' | 'quoteValidityDays';

export function getCompanyProfileFieldErrors(
  profile: Omit<CompanyProfile, 'quoteValidityDays'> & { quoteValidityDays: string | number },
): Partial<Record<CompanyProfileField, string>> {
  const errors: Partial<Record<CompanyProfileField, string>> = {};
  if (!profile.companyName.trim()) errors.companyName = 'Ingresá el nombre de la empresa.';
  if (profile.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim()))
    errors.email = 'Ingresá un email válido, por ejemplo nombre@empresa.com.';
  const digits = profile.whatsapp.replace(/\D/g, '');
  if (profile.whatsapp.trim() && (digits.length < 7 || digits.length > 15))
    errors.whatsapp = 'El WhatsApp debe tener entre 7 y 15 dígitos.';
  const days = Number(profile.quoteValidityDays);
  if (!Number.isInteger(days) || days < 1 || days > 365)
    errors.quoteValidityDays = 'Elegí una validez de 1 a 365 días.';
  return errors;
}

export function loadCompanyProfile(): CompanyProfile {
  try {
    const stored = localStorage.getItem(workspaceStorageKey(COMPANY_PROFILE_STORAGE_KEY));
    return (stored && normalizeCompanyProfile(JSON.parse(stored))) || defaultCompanyProfile;
  } catch {
    return defaultCompanyProfile;
  }
}

/** Whether this workspace saved its own data (otherwise Ventro's fallback is in use). */
export function hasStoredCompanyProfile(): boolean {
  try {
    return localStorage.getItem(workspaceStorageKey(COMPANY_PROFILE_STORAGE_KEY)) !== null;
  } catch {
    return false;
  }
}

export function saveCompanyProfile(profile: CompanyProfile): boolean {
  try {
    localStorage.setItem(workspaceStorageKey(COMPANY_PROFILE_STORAGE_KEY), JSON.stringify(profile));
    if (typeof window !== 'undefined')
      window.dispatchEvent(new Event(COMPANY_PROFILE_UPDATED_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function loadCompanyProfileVersion(): number | null {
  try {
    const value = Number(
      localStorage.getItem(workspaceStorageKey(COMPANY_PROFILE_VERSION_STORAGE_KEY)),
    );
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function saveCompanyProfileVersion(version: number | null): void {
  try {
    const key = workspaceStorageKey(COMPANY_PROFILE_VERSION_STORAGE_KEY);
    if (version === null) localStorage.removeItem(key);
    else localStorage.setItem(key, String(version));
  } catch {
    // A missing version only causes a conflict and a reload of the remote data.
  }
}

/** The PDF brand built from the profile; empty contact fields are simply left out. */
export function companyProfileToBrand(profile: CompanyProfile): DeploymentBrandConfig {
  return {
    companyName: profile.companyName,
    ...(profile.tagline ? { experienceMessage: profile.tagline } : {}),
    email: profile.email,
    whatsapp: { display: profile.whatsapp, value: profile.whatsapp.replace(/\D/g, '') },
    ...(profile.website ? { website: profile.website } : {}),
    ...(profile.instagram ? { instagram: profile.instagram } : {}),
    footerBusinessText: profile.footerText || profile.companyName,
    quoteValidityDays: profile.quoteValidityDays,
  };
}

export const loadCompanyBrand = () => companyProfileToBrand(loadCompanyProfile());
