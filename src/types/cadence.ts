import type { NextAction, NextActionType } from './opportunity';

export type CadenceStatus = 'active' | 'paused';
export type CadenceExecutionStatus = 'active' | 'paused' | 'cancelled' | 'completed';
export type CadenceWaitUnit = 'hours' | 'days';
export type CadenceTarget =
  { kind: 'opportunity'; opportunityId: string } | { kind: 'sentQuote'; quoteId: string };
export type CadenceEventType =
  'started' | 'advanced' | 'rescheduled' | 'paused' | 'resumed' | 'cancelled' | 'completed';

export interface CadenceStep {
  id: string;
  order: number;
  channel: NextActionType;
  description: string;
  waitAmount: number;
  waitUnit: CadenceWaitUnit;
  responsible: string;
  status: CadenceStatus;
}

export interface CadenceTemplate {
  id: string;
  name: string;
  description: string;
  status: CadenceStatus;
  steps: CadenceStep[];
  createdAt: string;
  updatedAt: string;
}

export interface CadenceEvent {
  id: string;
  type: CadenceEventType;
  occurredAt: string;
  actor: string;
  reason: string;
}

export interface CadenceStepExecution {
  id: string;
  templateStepId: string;
  order: number;
  channel: NextActionType;
  description: string;
  responsible: string;
  scheduledAt: string;
  status: 'pending' | 'completed' | 'skipped' | 'cancelled';
  nextAction?: NextAction;
  completedAt?: string;
  result?: string;
  history: CadenceEvent[];
}

export interface CadenceExecution {
  id: string;
  templateId: string;
  target: CadenceTarget;
  status: CadenceExecutionStatus;
  templateSnapshot: CadenceTemplate;
  currentStepExecutionId?: string;
  stepExecutions: CadenceStepExecution[];
  history: CadenceEvent[];
  createdAt: string;
  updatedAt: string;
}
