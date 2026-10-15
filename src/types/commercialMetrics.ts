import type { Activity } from './activity';
import type { CadenceExecution } from './cadence';
import type { Client } from './client';
import type { CommercialOutcome, CommercialReasonCode } from './commercialOutcome';
import type { Opportunity, OpportunityCommercialState } from './opportunity';
import type { SavedQuote } from './quote';

export interface CommercialMetricsFilters {
  startDate: string;
  endDate: string;
  period: 'current' | 'previous';
  responsible: string;
  service: string;
  channel: string;
  commercialState: 'all' | OpportunityCommercialState;
  reason: 'all' | CommercialReasonCode;
  clientId: string;
  opportunityId: string;
  quoteId: string;
}

export interface CommercialMetricsSources {
  opportunities: readonly Opportunity[];
  clients: readonly Client[];
  quotes: readonly SavedQuote[];
  activities: readonly Activity[];
  executions: readonly CadenceExecution[];
  outcomes: readonly CommercialOutcome[];
  issues: readonly (string | null)[];
}

export interface MetricValue {
  value: number;
  previous: number;
  comparison: number | null;
}
export interface CommercialMetrics {
  kpis: Record<
    | 'opportunitiesCreated'
    | 'quotesSent'
    | 'quotesAccepted'
    | 'quotesRejected'
    | 'opportunitiesLost'
    | 'opportunitiesReopened'
    | 'followUpsCompleted'
    | 'followUpsOverdue'
    | 'followUpsRescheduled',
    MetricValue
  >;
  opportunityConversion: { numerator: number; denominator: number; rate: number | null };
  quoteConversion: { numerator: number; denominator: number; rate: number | null };
  reasons: { code: CommercialReasonCode; count: number }[];
  trend: {
    day: string;
    label: string;
    created: number;
    sent: number;
    accepted: number;
    rejected: number;
    lost: number;
  }[];
  effectiveness: { label: string; completed: number; overdue: number; rescheduled: number }[];
  averageFirstContactHours: number | null;
  averageResultHours: number | null;
  hasAmbiguousCorrections: boolean;
  partialCoverage: boolean;
  empty: boolean;
}

export const defaultCommercialMetricsFilters: CommercialMetricsFilters = {
  startDate: '',
  endDate: '',
  period: 'current',
  responsible: 'all',
  service: 'all',
  channel: 'all',
  commercialState: 'all',
  reason: 'all',
  clientId: 'all',
  opportunityId: 'all',
  quoteId: 'all',
};
