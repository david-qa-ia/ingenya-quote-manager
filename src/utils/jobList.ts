import type { Client } from '../types/client';
import type { Opportunity } from '../types/opportunity';
import type { Prospect } from '../types/prospect';
import type { SavedQuote } from '../types/quote';
import { calculateQuoteTotal } from './quoteCalculations';

/**
 * A "job" (trabajo) is one sale from first contact to outcome. Until it is qualified it lives as a
 * prospect; afterwards as an opportunity. The list shows each sale once: a converted prospect is
 * represented by its opportunity.
 */
export type JobStage = 'new' | 'contacted' | 'quoting' | 'sent' | 'won' | 'lost';
export type JobStageFilter = JobStage | 'open' | 'all';

export const jobStageLabels: Record<JobStage, string> = {
  new: 'Nuevo',
  contacted: 'Contactado',
  quoting: 'Presupuestando',
  sent: 'Presupuesto enviado',
  won: 'Ganado',
  lost: 'Perdido',
};

export const jobStageOrder: readonly JobStage[] = [
  'new',
  'contacted',
  'quoting',
  'sent',
  'won',
  'lost',
];

export interface JobRow {
  kind: 'prospect' | 'opportunity';
  id: string;
  /** The client of an opportunity; prospects have none until they are converted. */
  clientId?: string;
  name: string;
  company: string;
  service: string;
  stage: JobStage;
  /** Total of the latest quote, or the estimated value while there is no quote. */
  amount?: number;
  nextStep?: { description: string; dueAt: string };
  updatedAt: string;
}

export interface JobSources {
  prospects: readonly Prospect[];
  opportunities: readonly Opportunity[];
  clients: readonly Client[];
  quotes: readonly SavedQuote[];
}

const closedStages: ReadonlySet<JobStage> = new Set(['won', 'lost']);

export const isOpenJob = (row: JobRow) => !closedStages.has(row.stage);

function prospectStage(prospect: Prospect): JobStage {
  if (prospect.status === 'notInterested') return 'lost';
  if (prospect.status === 'uncontacted' || prospect.status === 'contactToday') return 'new';
  return 'contacted';
}

function latestQuote(quotes: readonly SavedQuote[]): SavedQuote | undefined {
  return [...quotes].sort(
    (a, b) => (b.version ?? 1) - (a.version ?? 1) || b.savedAt.localeCompare(a.savedAt),
  )[0];
}

function opportunityStage(opportunity: Opportunity, quote: SavedQuote | undefined): JobStage {
  if (opportunity.commercialState === 'won' || opportunity.pipelineStage === 'won') return 'won';
  if (
    opportunity.commercialState === 'lost' ||
    opportunity.pipelineStage === 'lost' ||
    opportunity.status === 'cancelled'
  )
    return 'lost';
  if (quote?.commercialStatus === 'accepted') return 'won';
  if (quote?.commercialStatus === 'sent' || quote?.commercialStatus === 'followingUp')
    return 'sent';
  return 'quoting';
}

function prospectRow(prospect: Prospect): JobRow {
  return {
    kind: 'prospect',
    id: prospect.id,
    name: prospect.name,
    company: prospect.company,
    service: prospect.potentialService,
    stage: prospectStage(prospect),
    nextStep:
      prospect.nextAction.trim() && prospect.nextActionAt
        ? { description: prospect.nextAction.trim(), dueAt: prospect.nextActionAt }
        : undefined,
    updatedAt: prospect.updatedAt,
  };
}

function opportunityRow(
  opportunity: Opportunity,
  client: Client | undefined,
  quotes: readonly SavedQuote[],
): JobRow {
  const quote = latestQuote(quotes);
  const action = opportunity.nextAction;
  return {
    kind: 'opportunity',
    id: opportunity.id,
    clientId: opportunity.clientId,
    name: client?.name ?? opportunity.name,
    company: client?.company ?? '',
    service: opportunity.qualification?.serviceOfInterest || opportunity.name,
    stage: opportunityStage(opportunity, quote),
    amount: quote ? calculateQuoteTotal(quote.lines) : opportunity.qualification?.estimatedValue,
    nextStep:
      action?.status === 'pending'
        ? { description: action.description, dueAt: action.dueAt }
        : undefined,
    updatedAt: opportunity.updatedAt,
  };
}

/** Open jobs first, the most urgent next step on top; closed jobs last, newest first. */
function compareJobs(a: JobRow, b: JobRow): number {
  const openDifference = Number(isOpenJob(b)) - Number(isOpenJob(a));
  if (openDifference) return openDifference;
  if (isOpenJob(a)) {
    if (a.nextStep && b.nextStep) return a.nextStep.dueAt.localeCompare(b.nextStep.dueAt);
    if (a.nextStep || b.nextStep) return a.nextStep ? -1 : 1;
  }
  return b.updatedAt.localeCompare(a.updatedAt);
}

export function buildJobList(sources: JobSources): JobRow[] {
  const clients = new Map(sources.clients.map((client) => [client.id, client]));
  const quotesByOpportunity = new Map<string, SavedQuote[]>();
  for (const quote of sources.quotes) {
    if (!quote.opportunityId) continue;
    quotesByOpportunity.set(quote.opportunityId, [
      ...(quotesByOpportunity.get(quote.opportunityId) ?? []),
      quote,
    ]);
  }
  const prospects = sources.prospects
    .filter(
      (prospect) =>
        !prospect.archivedAt &&
        prospect.status !== 'converted' &&
        prospect.conversion?.state !== 'completed',
    )
    .map(prospectRow);
  const opportunities = sources.opportunities.map((opportunity) =>
    opportunityRow(
      opportunity,
      clients.get(opportunity.clientId),
      quotesByOpportunity.get(opportunity.id) ?? [],
    ),
  );
  return [...prospects, ...opportunities].sort(compareJobs);
}

/** Lowercase without accents, so "Gomez" finds "Gómez". */
export const normalizeSearchText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es');

export function filterJobs(
  rows: readonly JobRow[],
  filter: { stage: JobStageFilter; query: string },
): JobRow[] {
  const query = normalizeSearchText(filter.query.trim());
  return rows.filter((row) => {
    if (filter.stage === 'open' && !isOpenJob(row)) return false;
    if (filter.stage !== 'open' && filter.stage !== 'all' && row.stage !== filter.stage)
      return false;
    return (
      !query || normalizeSearchText(`${row.name} ${row.company} ${row.service}`).includes(query)
    );
  });
}

export function countJobsByStage(rows: readonly JobRow[]): Record<JobStageFilter, number> {
  const counts = Object.fromEntries(jobStageOrder.map((stage) => [stage, 0])) as Record<
    JobStage,
    number
  >;
  for (const row of rows) counts[row.stage] += 1;
  return { ...counts, open: rows.filter(isOpenJob).length, all: rows.length };
}
