import type { SavedQuote } from '../types/quote';
import type { Opportunity } from '../types/opportunity';
import { ACTIVITIES_STORAGE_KEY, recordAutomaticActivity } from './activityStorage';
import { OPPORTUNITIES_STORAGE_KEY, saveOpportunity } from './opportunityStorage';
import { linkQuoteToOpportunity, SAVED_QUOTES_STORAGE_KEY } from './quoteDraftStorage';
import { workspaceStorageKey } from './workspaceStorage';

export function convertDirectQuoteToOpportunity(
  quote: SavedQuote,
): { ok: true; opportunity: Opportunity } | { ok: false; message: string } {
  if (!quote.clientId)
    return { ok: false, message: 'El presupuesto necesita un cliente antes de convertirlo.' };
  if (quote.opportunityId)
    return { ok: false, message: 'Este presupuesto ya tiene una oportunidad vinculada.' };
  const now = new Date().toISOString();
  const opportunity: Opportunity = {
    id: crypto.randomUUID(),
    clientId: quote.clientId,
    name: quote.projectName || `Presupuesto ${quote.id}`,
    address: '',
    estimatedStartDate: '',
    responsibleSeller: 'Sin asignar',
    origin: 'Presupuesto directo',
    status: 'active',
    commercialState: 'open',
    pipelineStage: 'opportunity',
    createdAt: now,
    updatedAt: now,
  };
  const keys = [OPPORTUNITIES_STORAGE_KEY, SAVED_QUOTES_STORAGE_KEY, ACTIVITIES_STORAGE_KEY];
  const snapshots = new Map(
    keys.map((key) => [workspaceStorageKey(key), localStorage.getItem(workspaceStorageKey(key))]),
  );
  const rollback = () => {
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
    if (
      !saveOpportunity(opportunity) ||
      !linkQuoteToOpportunity(quote.id, opportunity.id) ||
      !recordAutomaticActivity(
        { kind: 'opportunity', opportunityId: opportunity.id },
        'created',
        'Oportunidad creada desde presupuesto directo.',
      )
    )
      throw new Error();
    return { ok: true, opportunity };
  } catch {
    return {
      ok: false,
      message: rollback()
        ? 'No se pudo convertir el presupuesto. No se realizaron cambios.'
        : 'No se pudo verificar la reversión. Revisá la oportunidad antes de reintentar.',
    };
  }
}
