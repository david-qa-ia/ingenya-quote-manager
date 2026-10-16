import type { NextAction, NextActionPriority, NextActionType } from './opportunity';

export type FollowUpBucket = 'overdue' | 'today' | 'upcoming' | 'missing';
export type FollowUpSource = 'manual' | 'opportunityCadence' | 'quoteCadence' | 'missing';
export type FollowUpSort = 'priority' | 'date';

export interface FollowUpInboxItem {
  id: string;
  subjectType?: 'prospect' | 'opportunity' | 'quote';
  prospectId?: string;
  bucket: FollowUpBucket;
  source: FollowUpSource;
  action?: NextAction;
  clientId?: string;
  clientName: string;
  clientCompany?: string;
  estimatedValue?: number;
  phone?: string;
  email?: string;
  contactRestricted: boolean;
  opportunityId?: string;
  opportunityName?: string;
  quoteId?: string;
  quoteName?: string;
  responsible: string;
  channel?: NextActionType;
  manualPriority?: NextActionPriority;
  cadenceStep?: { current: number; total: number; executionId: string; stepExecutionId: string };
  rescheduleCount: number;
  priority: { score: number; level: NextActionPriority; reasons: string[] };
  warning?: string;
}

export interface FollowUpFilters {
  bucket: 'all' | FollowUpBucket;
  responsible: string;
  channel: 'all' | NextActionType;
  priority: 'all' | NextActionPriority;
  search: string;
  nextSevenDays: boolean;
  sort: FollowUpSort;
}
