export type NextActionType =
  'call' | 'whatsapp' | 'email' | 'meeting' | 'waitForResponse' | 'other';
export type OpportunityStatus = 'active' | 'cancelled' | 'converted' | 'closed';

export type NextActionStatus = 'pending' | 'completed' | 'cancelled' | 'notRelevant';
export type NextActionPriority = 'low' | 'medium' | 'high';
export type NextActionHistoryEvent =
  'created' | 'rescheduled' | 'completed' | 'cancelled' | 'notRelevant';

export interface NextActionHistoryEntry {
  id: string;
  occurredAt: string;
  actor: string;
  event: NextActionHistoryEvent;
  reason: string;
  previousDueAt?: string;
  result?: string;
}

export interface NextAction {
  id: string;
  type: NextActionType;
  description: string;
  dueAt: string;
  responsible: string;
  priority: NextActionPriority;
  status: NextActionStatus;
  createdAt: string;
  updatedAt: string;
  history: NextActionHistoryEntry[];
}

export interface NoNextActionException {
  reason: string;
  recordedAt: string;
  recordedBy: string;
}

export interface Opportunity {
  id: string;
  clientId: string;
  name: string;
  address: string;
  estimatedStartDate: string;
  responsibleSeller: string;
  status?: OpportunityStatus;
  nextAction?: NextAction;
  noNextActionException?: NoNextActionException;
  createdAt: string;
  updatedAt: string;
}

export type OpportunityInput = Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt'>;
