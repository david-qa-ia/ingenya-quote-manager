import type { Activity } from '../types/activity';
import type { Opportunity } from '../types/opportunity';
import type { CommercialStatusAudit, SavedQuote } from '../types/quote';
import { ACTIVITIES_STORAGE_KEY } from './activityStorage';
import { OPPORTUNITIES_STORAGE_KEY } from './opportunityStorage';
import { SAVED_QUOTES_STORAGE_KEY } from './quoteDraftStorage';
import { readCollection } from './localCollectionStorage';
import { workspaceStorageKey } from './workspaceStorage';
import { emitLocalWrite } from './localWriteEvents';

export const QUOTE_SEND_RECOVERY_STORAGE_KEY = 'ingenya.quoteSendRecovery.v1';

interface QuoteSendRecovery {
  quoteId: string;
  recordedAt: string;
}

export function saveQuoteSendRecovery(quoteId: string): void {
  try {
    localStorage.setItem(
      workspaceStorageKey(QUOTE_SEND_RECOVERY_STORAGE_KEY),
      JSON.stringify({ quoteId, recordedAt: new Date().toISOString() } satisfies QuoteSendRecovery),
    );
  } catch {
    // The transaction error remains visible even if the recovery marker cannot be persisted.
  }
}

export function hasQuoteSendRecovery(quoteId: string): boolean {
  try {
    const raw = localStorage.getItem(workspaceStorageKey(QUOTE_SEND_RECOVERY_STORAGE_KEY));
    if (!raw) return false;
    const value = JSON.parse(raw) as Partial<QuoteSendRecovery>;
    return value.quoteId === quoteId;
  } catch {
    return false;
  }
}

export interface QuoteSendTransactionInput {
  quote: SavedQuote;
  audit: CommercialStatusAudit;
  nextStep?: { type: 'call' | 'whatsapp' | 'email' | 'meeting'; dueAt: string };
  replaceExistingNextAction?: boolean;
}
export function commitLocalQuoteSend(input: QuoteSendTransactionInput): {
  ok: boolean;
  error?: string;
  recoveryRequired?: boolean;
} {
  const keys = [SAVED_QUOTES_STORAGE_KEY, ACTIVITIES_STORAGE_KEY, OPPORTUNITIES_STORAGE_KEY];
  const snapshots = new Map<string, string | null>();
  try {
    keys.forEach((key) =>
      snapshots.set(workspaceStorageKey(key), localStorage.getItem(workspaceStorageKey(key))),
    );
    const quotes = readCollection(SAVED_QUOTES_STORAGE_KEY) as SavedQuote[];
    const quoteIndex = quotes.findIndex((quote) => quote.id === input.quote.id);
    if (quoteIndex < 0 || quotes[quoteIndex].commercialStatus !== 'prepared')
      return { ok: false, error: 'La versión ya fue enviada o cambió en otra operación.' };
    const updatedQuote: SavedQuote = {
      ...quotes[quoteIndex],
      commercialStatus: 'sent',
      commercialStatusAudit: input.audit,
      sentAudit: input.audit,
      savedAt: new Date().toISOString(),
    };
    quotes[quoteIndex] = updatedQuote;
    const activities = readCollection(ACTIVITIES_STORAGE_KEY) as Activity[];
    activities.push({
      id: crypto.randomUUID(),
      type:
        input.audit.channel === 'whatsapp'
          ? 'whatsapp'
          : input.audit.channel === 'email'
            ? 'email'
            : 'note',
      occurredAt: input.audit.changedAt,
      author: input.audit.changedBy,
      result: 'sent',
      note: input.audit.reason,
      subject: { kind: 'quote', quoteId: input.quote.id },
      source: 'manual',
      noteRevisions: [],
    });
    const opportunities = readCollection(OPPORTUNITIES_STORAGE_KEY) as Opportunity[];
    const opportunityIndex = opportunities.findIndex(
      (opportunity) => opportunity.id === input.quote.opportunityId,
    );
    if (opportunityIndex >= 0) {
      const opportunity = opportunities[opportunityIndex];
      opportunities[opportunityIndex] = {
        ...opportunity,
        pipelineStage: 'proposal',
        updatedAt: input.audit.changedAt,
        ...(input.nextStep && (!opportunity.nextAction || input.replaceExistingNextAction)
          ? {
              nextAction: {
                id: crypto.randomUUID(),
                kind: 'followUp',
                type: input.nextStep.type,
                description: 'Dar seguimiento al presupuesto enviado',
                dueAt: input.nextStep.dueAt,
                responsible: input.audit.changedBy,
                priority: 'medium',
                suggestedChannel: input.nextStep.type,
                status: 'pending',
                createdAt: input.audit.changedAt,
                updatedAt: input.audit.changedAt,
                history: [
                  {
                    id: crypto.randomUUID(),
                    occurredAt: input.audit.changedAt,
                    actor: input.audit.changedBy,
                    event: 'created',
                    reason: 'Creada al registrar el envío del presupuesto.',
                  },
                ],
              },
            }
          : {}),
      };
    }
    localStorage.setItem(workspaceStorageKey(SAVED_QUOTES_STORAGE_KEY), JSON.stringify(quotes));
    localStorage.setItem(workspaceStorageKey(ACTIVITIES_STORAGE_KEY), JSON.stringify(activities));
    localStorage.setItem(
      workspaceStorageKey(OPPORTUNITIES_STORAGE_KEY),
      JSON.stringify(opportunities),
    );
    emitLocalWrite();
    return { ok: true };
  } catch {
    try {
      for (const [key, snapshot] of snapshots) {
        if (snapshot === null) localStorage.removeItem(key);
        else localStorage.setItem(key, snapshot);
      }
      const verified = [...snapshots].every(
        ([key, snapshot]) => localStorage.getItem(key) === snapshot,
      );
      if (!verified) {
        saveQuoteSendRecovery(input.quote.id);
        return {
          ok: false,
          recoveryRequired: true,
          error:
            'No se pudo verificar la restauración local. No repitas el envío; recuperá el registro antes de continuar.',
        };
      }
      return { ok: false, error: 'No se pudo registrar el envío. Se restauraron los cambios.' };
    } catch {
      saveQuoteSendRecovery(input.quote.id);
      return {
        ok: false,
        recoveryRequired: true,
        error:
          'No se pudo verificar la restauración local. No repitas el envío; recuperá el registro antes de continuar.',
      };
    }
  }
}
