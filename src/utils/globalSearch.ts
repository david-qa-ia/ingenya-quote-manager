import type { Client } from '../types/client';
import type { GlobalSearchResult } from '../types/globalSearch';
import type { Opportunity } from '../types/opportunity';
import type { SavedQuote } from '../types/quote';

export function isQuoteWithoutResponse(quote: SavedQuote, now = new Date()): boolean {
  if (!['sent', 'followingUp'].includes(quote.commercialStatus)) return false;
  const sentAt = quote.sentAudit?.changedAt ?? quote.commercialStatusAudit.changedAt;
  return Number.isFinite(Date.parse(sentAt)) && now.getTime() - Date.parse(sentAt) >= 7 * 86400000;
}

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim();

const digits = (value: string) => value.replace(/\D/g, '');

function scoreMatch(query: string, values: string[]): number {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return 0;
  const compactQuery = digits(normalizedQuery) || normalizedQuery;
  return values.reduce((best, value) => {
    const normalizedValue = normalize(value);
    const searchable = digits(normalizedValue) || normalizedValue;
    if (searchable === compactQuery) return Math.max(best, 100);
    if (searchable.startsWith(compactQuery)) return Math.max(best, 80);
    if (searchable.includes(compactQuery)) return Math.max(best, 50);
    return best;
  }, 0);
}

export function deriveGlobalSearchResults(
  query: string,
  clients: readonly Client[],
  opportunities: readonly Opportunity[],
  quotes: readonly SavedQuote[],
): GlobalSearchResult[] {
  if (!query.trim()) return [];
  const clientsById = new Map(clients.map((client) => [client.id, client]));
  const opportunitiesById = new Map(opportunities.map((item) => [item.id, item]));
  const results: GlobalSearchResult[] = [];

  for (const client of clients) {
    const score = scoreMatch(query, [
      client.name,
      client.company ?? '',
      client.phone,
      client.email,
    ]);
    if (score) {
      results.push({
        id: `client:${client.id}`,
        group: 'contacts',
        title: client.name,
        context: [client.company, client.phone, client.email].filter(Boolean).join(' · '),
        icon: 'person',
        client,
        score,
      });
    }
  }

  for (const opportunity of opportunities) {
    const client = clientsById.get(opportunity.clientId);
    const score = scoreMatch(query, [
      opportunity.name,
      opportunity.address,
      opportunity.qualification?.serviceOfInterest ?? '',
      client?.name ?? '',
      client?.company ?? '',
    ]);
    if (score) {
      results.push({
        id: `opportunity:${opportunity.id}`,
        group: 'opportunities',
        title: opportunity.name,
        context: [opportunity.pipelineStage ?? 'Oportunidad', client?.company ?? client?.name]
          .filter(Boolean)
          .join(' · '),
        icon: 'calendar-check',
        opportunity,
        client,
        score,
      });
    }
  }

  for (const quote of quotes) {
    const opportunity = quote.opportunityId
      ? opportunitiesById.get(quote.opportunityId)
      : undefined;
    const client = quote.clientId ? clientsById.get(quote.clientId) : undefined;
    const versionLabel = `V${quote.version ?? 1}`;
    const score = scoreMatch(query, [
      quote.id,
      quote.projectName,
      quote.clientName,
      client?.name ?? '',
      client?.company ?? '',
    ]);
    if (score) {
      results.push({
        id: `quote:${quote.id}`,
        group: 'quotes',
        title: quote.id,
        context: [versionLabel, quote.projectName || opportunity?.name, quote.clientName]
          .filter(Boolean)
          .join(' · '),
        icon: 'document',
        quote,
        opportunity,
        client,
        score,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'es'));
}
