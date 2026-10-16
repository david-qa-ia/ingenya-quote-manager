import type { Client, ClientInput } from '../types/client';

export const PENDING_PHONE = '1111111111';
export const PENDING_EMAIL = 'none';

export function isPendingPhone(phone: string): boolean {
  return phone.replace(/\D/g, '') === PENDING_PHONE;
}

export function isPendingEmail(email: string): boolean {
  return email.trim().toLowerCase() === PENDING_EMAIL;
}

export function getClientValidationError(input: ClientInput): string | null {
  if (!input.name.trim()) return 'Ingresá el nombre del cliente.';
  if (
    !/^\+?[\d\s().-]+$/.test(input.phone.trim()) ||
    !/^\d{7,15}$/.test(input.phone.replace(/\D/g, ''))
  ) {
    return 'Ingresá un teléfono de 7 a 15 dígitos o 1111111111 si está pendiente.';
  }
  if (
    input.doNotContact &&
    (!input.doNotContact.reason.trim() ||
      !input.doNotContact.recordedBy.trim() ||
      !Number.isFinite(Date.parse(input.doNotContact.recordedAt)))
  )
    return 'Ingresá motivo, fecha y autor del pedido de no contacto.';
  if (!isPendingEmail(input.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    return 'Ingresá un email válido o none si está pendiente.';
  }
  if (
    !['', 'phone', 'whatsapp', 'email'].includes(input.preferredChannel) ||
    typeof input.contactConsent !== 'boolean'
  ) {
    return 'Revisá el canal preferido y el consentimiento de contacto.';
  }
  return null;
}

export function normalizeClientInput(input: ClientInput): ClientInput {
  return {
    name: input.name.trim(),
    ...(input.company?.trim() ? { company: input.company.trim() } : {}),
    phone: isPendingPhone(input.phone) ? PENDING_PHONE : input.phone.trim(),
    email: isPendingEmail(input.email) ? PENDING_EMAIL : input.email.trim(),
    preferredChannel: input.preferredChannel,
    contactConsent: input.contactConsent,
    ...(input.doNotContact
      ? {
          doNotContact: {
            ...input.doNotContact,
            reason: input.doNotContact.reason.trim(),
            recordedBy: input.doNotContact.recordedBy.trim(),
          },
        }
      : {}),
  };
}

export function isClient(value: unknown): value is Client {
  if (typeof value !== 'object' || value === null) return false;
  const client = value as Record<string, unknown>;
  return (
    ['id', 'name', 'phone', 'email', 'preferredChannel', 'createdAt', 'updatedAt'].every(
      (key) => typeof client[key] === 'string',
    ) &&
    (client.id as string).trim().length > 0 &&
    Number.isFinite(Date.parse(client.createdAt as string)) &&
    Number.isFinite(Date.parse(client.updatedAt as string)) &&
    getClientValidationError(client as unknown as ClientInput) === null
  );
}

// This describes contact eligibility only; SCRUM-46 does not send communications.
export function canContactClient(
  client: ClientInput,
  channel: 'phone' | 'whatsapp' | 'email',
): boolean {
  return (
    client.contactConsent &&
    !client.doNotContact &&
    getClientValidationError(client) === null &&
    (channel === 'email' ? !isPendingEmail(client.email) : !isPendingPhone(client.phone))
  );
}
