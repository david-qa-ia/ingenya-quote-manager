import type { Opportunity } from '../types/opportunity';
import type { Prospect } from '../types/prospect';
import {
  normalizeSearchText,
  opportunityJobRow,
  prospectJobRow,
  type JobRow,
  type JobSources,
  type JobStage,
} from './jobList';

/**
 * The job file (ficha de trabajo) shows one sale whatever record holds it today: a prospect
 * before conversion, its opportunity afterwards. Every place that opens a sale points at a
 * record, and these functions decide which file that is and how its header reads.
 */
export interface JobRef {
  kind: JobRow['kind'];
  id: string;
}

/** The opportunity a prospect became, once its conversion finished. */
export function getConvertedOpportunityId(prospect: Prospect): string | undefined {
  return prospect.conversion?.state === 'completed'
    ? prospect.conversion.draft.opportunityId
    : undefined;
}

/**
 * The record the job file shows for `ref`. A converted prospect is the same sale as its
 * opportunity, so it opens the opportunity; if that opportunity is not in this browser, the
 * prospect stays visible. Returns null when the record does not exist.
 */
export function resolveJobRef(
  ref: JobRef,
  sources: { prospects: readonly Prospect[]; opportunities: readonly Opportunity[] },
): JobRef | null {
  if (ref.kind === 'opportunity')
    return sources.opportunities.some((item) => item.id === ref.id) ? ref : null;
  const prospect = sources.prospects.find((item) => item.id === ref.id);
  if (!prospect) return null;
  const opportunityId = getConvertedOpportunityId(prospect);
  if (opportunityId && sources.opportunities.some((item) => item.id === opportunityId))
    return { kind: 'opportunity', id: opportunityId };
  return ref;
}

export interface JobFileHeading {
  name: string;
  /** Company and service, as the job reads in Trabajos. */
  detail: string;
  stage: JobStage;
}

/**
 * The header of a job file. It is built like the row in Trabajos, so the same sale keeps its
 * name and reads the same before and after the prospect is converted.
 */
export function getJobFileHeading(ref: JobRef, sources: JobSources): JobFileHeading | undefined {
  const resolved = resolveJobRef(ref, sources);
  if (!resolved) return undefined;
  let row: JobRow | undefined;
  if (resolved.kind === 'prospect') {
    const prospect = sources.prospects.find((item) => item.id === resolved.id);
    row = prospect && prospectJobRow(prospect);
  } else {
    const opportunity = sources.opportunities.find((item) => item.id === resolved.id);
    row =
      opportunity &&
      opportunityJobRow(
        opportunity,
        sources.clients.find((client) => client.id === opportunity.clientId),
        sources.quotes.filter((quote) => quote.opportunityId === opportunity.id),
      );
  }
  return row && jobFileHeadingFromRow(row);
}

export function jobFileHeadingFromRow(row: JobRow): JobFileHeading {
  return {
    name: row.name,
    detail: [row.company, row.service].filter(Boolean).join(' · '),
    stage: row.stage,
  };
}

/**
 * The project name to show under a job file header, or '' when it adds nothing: when it is
 * empty, or when it already repeats the service (a converted prospect is named
 * "Empresa · Servicio" by default).
 */
export function getJobProjectName(opportunity: Opportunity): string {
  const name = opportunity.name.trim();
  const service = opportunity.qualification?.serviceOfInterest.trim() ?? '';
  if (!name || !service) return '';
  return normalizeSearchText(name).includes(normalizeSearchText(service)) ? '' : name;
}
