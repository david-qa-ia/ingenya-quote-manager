import type { Client } from '../types/client';
import type { Quote } from '../types/quote';
import { recordAutomaticActivity, ACTIVITIES_STORAGE_KEY } from './activityStorage';
import { CLIENTS_STORAGE_KEY, loadClients, saveClient } from './clientStorage';
import { PENDING_EMAIL, PENDING_PHONE } from './clientValidation';
import { OPPORTUNITIES_STORAGE_KEY, saveOpportunity } from './opportunityStorage';
import { saveQuote, SAVED_QUOTES_STORAGE_KEY } from './quoteDraftStorage';
import { workspaceStorageKey } from './workspaceStorage';

export interface DirectClientInput {
  name: string;
  company: string;
  phone: string;
  email: string;
  projectName: string;
  duplicateConfirmed?: boolean;
  duplicateReason?: string;
}

export interface DirectQuoteFollowUpInput {
  dueAt: string;
  channel: 'call' | 'whatsapp' | 'email' | 'meeting' | 'other';
  responsible: string;
}

export type DirectClientQuoteResult =
  { ok: true; client: Client } | { ok: false; message: string; recoveryRequired?: boolean };

/** Creates the contact and its first quote as one local operation. */
export function saveDirectClientQuote(
  quote: Quote,
  input: DirectClientInput,
  followUp?: DirectQuoteFollowUpInput,
): DirectClientQuoteResult {
  const name = input.name.trim();
  const company = input.company.trim();
  if (!name && !company)
    return { ok: false, message: 'Ingresá el nombre o la empresa del cliente.' };
  if (followUp && (!followUp.dueAt || !followUp.responsible.trim()))
    return {
      ok: false,
      message: 'Completá fecha, hora y responsable para agendar el seguimiento.',
    };
  const normalizedPhone = input.phone.replace(/\D/g, '');
  const normalizedEmail = input.email.trim().toLowerCase();
  const hasDuplicate = loadClients().items.some((item) => {
    const samePhone =
      normalizedPhone.length >= 7 && item.phone.replace(/\D/g, '') === normalizedPhone;
    const sameEmail =
      normalizedEmail.length > 0 && item.email.trim().toLowerCase() === normalizedEmail;
    const sameNameCompany = Boolean(
      name &&
      company &&
      item.name.trim().toLowerCase() === name.toLowerCase() &&
      item.company?.trim().toLowerCase() === company.toLowerCase(),
    );
    return samePhone || sameEmail || sameNameCompany;
  });
  if (hasDuplicate && (!input.duplicateConfirmed || !input.duplicateReason?.trim()))
    return {
      ok: false,
      message:
        'Encontramos una coincidencia. Elegí el cliente existente o confirmá por qué crear uno nuevo.',
    };

  const now = new Date().toISOString();
  const client: Client = {
    id: crypto.randomUUID(),
    name: name || company,
    ...(company ? { company } : {}),
    phone: input.phone.trim() || PENDING_PHONE,
    email: input.email.trim() || PENDING_EMAIL,
    preferredChannel: '',
    contactConsent: false,
    createdAt: now,
    updatedAt: now,
  };
  const keys = [
    CLIENTS_STORAGE_KEY,
    OPPORTUNITIES_STORAGE_KEY,
    SAVED_QUOTES_STORAGE_KEY,
    ACTIVITIES_STORAGE_KEY,
  ];
  const snapshots = new Map(
    keys.map((key) => [workspaceStorageKey(key), localStorage.getItem(workspaceStorageKey(key))]),
  );
  const restore = () => {
    try {
      for (const [key, value] of snapshots) {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      }
      return [...snapshots].every(([key, value]) => localStorage.getItem(key) === value);
    } catch {
      return false;
    }
  };
  try {
    if (!saveClient(client)) throw new Error('client');
    const opportunity = followUp
      ? {
          id: crypto.randomUUID(),
          clientId: client.id,
          name: quote.projectName.trim() || `Seguimiento de ${client.name}`,
          address: '',
          estimatedStartDate: '',
          responsibleSeller: followUp.responsible.trim(),
          origin: 'Presupuesto directo',
          status: 'active' as const,
          commercialState: 'open' as const,
          pipelineStage: 'opportunity' as const,
          nextAction: {
            id: crypto.randomUUID(),
            kind: 'followUp' as const,
            type: followUp.channel,
            description: 'Dar seguimiento al presupuesto',
            dueAt: followUp.dueAt,
            responsible: followUp.responsible.trim(),
            priority: 'medium' as const,
            status: 'pending' as const,
            createdAt: now,
            updatedAt: now,
            history: [],
          },
          createdAt: now,
          updatedAt: now,
        }
      : undefined;
    if (opportunity && !saveOpportunity(opportunity)) throw new Error('opportunity');
    if (
      !saveQuote({
        ...quote,
        clientId: client.id,
        clientName: client.name,
        ...(opportunity ? { opportunityId: opportunity.id } : {}),
      })
    )
      throw new Error('quote');
    if (
      !recordAutomaticActivity(
        { kind: 'quote', quoteId: quote.id },
        'created',
        'Presupuesto creado para cliente directo.',
      )
    )
      throw new Error('activity');
    return { ok: true, client };
  } catch {
    const restored = restore();
    return restored
      ? {
          ok: false,
          message: 'No se pudo guardar el cliente y el presupuesto. No se realizaron cambios.',
        }
      : {
          ok: false,
          recoveryRequired: true,
          message:
            'No se pudo verificar la reversión. Conservamos el formulario para recuperar la operación.',
        };
  }
}
