import type { Client } from '../types/client';
import type { ContactChannel, ContactScriptVariable } from '../types/contactScript';
import type { Opportunity } from '../types/opportunity';
import type { Quote } from '../types/quote';
import { canContactClient } from './clientValidation';
import { getContactScriptTokenErrors } from './contactScriptStorage';
import { calculateQuoteTotal } from './quoteCalculations';

export interface ContactContext {
  client?: Client;
  opportunity?: Opportunity;
  quote?: Quote;
}
export function getContactEligibility(
  context: ContactContext,
  channel: ContactChannel,
): string | null {
  const client = context.client;
  if (!client) return 'No hay un cliente disponible para preparar este contacto.';
  if (client.doNotContact) return 'Este cliente solicitó no recibir contactos.';
  if (!client.contactConsent) return 'El cliente no otorgó consentimiento de contacto.';
  if (!canContactClient(client, channel === 'call' ? 'phone' : 'whatsapp'))
    return 'El teléfono está pendiente de confirmar o no es válido para este contacto.';
  return null;
}
export function getContactValues(
  context: ContactContext,
): Partial<Record<ContactScriptVariable, string>> {
  const services = context.quote?.lines.map((line) => line.name).filter(Boolean) ?? [];
  return {
    cliente: context.client?.name || context.quote?.clientName || undefined,
    oportunidad: context.opportunity?.name || context.quote?.projectName || undefined,
    servicio: services.length === 1 ? services[0] : undefined,
    presupuesto: context.quote?.id,
    total: context.quote
      ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(
          calculateQuoteTotal(context.quote.lines),
        )
      : undefined,
    responsable: context.opportunity?.responsibleSeller || undefined,
    proximaAccion:
      context.opportunity?.nextAction?.status === 'pending'
        ? context.opportunity.nextAction.description
        : undefined,
  };
}
export function renderContactScript(content: string, context: ContactContext) {
  const tokenErrors = getContactScriptTokenErrors(content);
  const values = getContactValues(context);
  const missing: ContactScriptVariable[] = [];
  const rendered = content.replace(/{{\s*([^}]+)\s*}}/g, (token, raw: string) => {
    const variable = raw.trim() as ContactScriptVariable;
    if (!(variable in values)) return token;
    const value = values[variable];
    if (!value) {
      missing.push(variable);
      return token;
    }
    return value;
  });
  return {
    rendered,
    tokenErrors,
    missing: [...new Set(missing)],
    services: context.quote?.lines.map((line) => line.name) ?? [],
  };
}
