import type { Activity } from './activity';
import type { CadenceExecution } from './cadence';
import type { Client } from './client';
import type { CommercialOutcome } from './commercialOutcome';
import type { Opportunity } from './opportunity';
import type { Prospect } from './prospect';
import type { SavedQuote } from './quote';

export interface CommercialMetricsFilters {
  startDate: string;
  endDate: string;
  period: 'current' | 'previous';
  responsible: string;
  channel: string;
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
  /** Prospect activity is part of the commercial work even before a conversion (SCRUM-105). */
  prospects?: readonly Prospect[];
  issues: readonly (string | null)[];
}

export interface MetricValue {
  value: number;
  previous: number;
  comparison: number | null;
}

export type ActivityFocus =
  'registerContact' | 'followUpContacts' | 'defineNextStep' | 'keepMomentum';

export interface CommercialMetrics {
  kpis: Record<
    | 'activitiesRegistered'
    | 'contactsRegistered'
    | 'effectiveContacts'
    | 'notesAdded'
    | 'quotesSent'
    | 'followUpsCompleted'
    | 'followUpsRescheduled',
    MetricValue
  >;
  trend: {
    day: string;
    label: string;
    activities: number;
    contacts: number;
    effectiveContacts: number;
    notes: number;
    sent: number;
  }[];
  activityBreakdown: {
    label: string;
    count: number;
  }[];
  followUpActions: { completed: number; rescheduled: number };
  contactEffectiveness: { effective: number; registered: number };
  focus: ActivityFocus;
  partialCoverage: boolean;
  empty: boolean;
}

export const defaultCommercialMetricsFilters: CommercialMetricsFilters = {
  startDate: '',
  endDate: '',
  period: 'current',
  responsible: 'all',
  channel: 'all',
  clientId: 'all',
  opportunityId: 'all',
  quoteId: 'all',
};
