import type { Prospect } from '../types/prospect';
import { isPendingEmail, isPendingPhone } from './clientValidation';

const normalizeText = (value: string | undefined) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('es')
    .replace(/\s+/g, ' ')
    .trim();

/** Last 10 digits, so "+54 9 341 555-1234" and "341 5551234" are the same phone. */
const phoneKey = (phone: string) => {
  if (!phone.trim() || isPendingPhone(phone)) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 ? digits.slice(-10) : '';
};

const emailKey = (email: string) =>
  !email.trim() || isPendingEmail(email) ? '' : email.trim().toLocaleLowerCase('es');

const instagramKey = (instagram: string | undefined) =>
  normalizeText(instagram)
    .replace(/^https?:\/\/(www\.)?instagram\.com\//, '')
    .replace(/^@/, '')
    .replace(/\/+$/, '');

export type ProspectDuplicateReason = 'phone' | 'email' | 'instagram' | 'nameAndCompany';

export interface ProspectDuplicate {
  prospect: Prospect;
  reasons: ProspectDuplicateReason[];
}

export const prospectDuplicateReasonLabels: Record<ProspectDuplicateReason, string> = {
  phone: 'mismo teléfono',
  email: 'mismo email',
  instagram: 'mismo Instagram',
  nameAndCompany: 'mismo nombre y empresa',
};

/**
 * SCRUM-118: prospects that look like the one being saved. The user decides: open the existing
 * one or save anyway (two people can share a company phone, for example).
 */
export function findProspectDuplicates(
  candidate: Pick<Prospect, 'id' | 'name' | 'company' | 'phone' | 'email' | 'instagram'>,
  prospects: readonly Prospect[],
): ProspectDuplicate[] {
  const phone = phoneKey(candidate.phone);
  const email = emailKey(candidate.email);
  const instagram = instagramKey(candidate.instagram);
  const name = normalizeText(candidate.name);
  const company = normalizeText(candidate.company);
  return prospects
    .filter((prospect) => prospect.id !== candidate.id)
    .map((prospect) => {
      const reasons: ProspectDuplicateReason[] = [];
      if (phone && phoneKey(prospect.phone) === phone) reasons.push('phone');
      if (email && emailKey(prospect.email) === email) reasons.push('email');
      if (instagram && instagramKey(prospect.instagram) === instagram) reasons.push('instagram');
      if (
        name &&
        company &&
        normalizeText(prospect.name) === name &&
        normalizeText(prospect.company) === company
      )
        reasons.push('nameAndCompany');
      return { prospect, reasons };
    })
    .filter((entry) => entry.reasons.length > 0);
}

/** SCRUM-118: a new prospect needs at least one way to reach them. Form-only rule (not CSV). */
export function getProspectContactRequirementError(
  input: Pick<Prospect, 'phone' | 'email' | 'instagram'>,
): string | null {
  const hasPhone = Boolean(input.phone.trim()) && !isPendingPhone(input.phone);
  const hasEmail = Boolean(input.email.trim()) && !isPendingEmail(input.email);
  const hasInstagram = Boolean(input.instagram?.trim());
  return hasPhone || hasEmail || hasInstagram
    ? null
    : 'Cargá al menos un teléfono, email o Instagram para poder contactarlo.';
}
