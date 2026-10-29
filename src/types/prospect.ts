export type ProspectStatus =
  | 'uncontacted'
  | 'contactToday'
  | 'contacted'
  | 'noResponse'
  | 'interested'
  | 'notInterested'
  | 'converted';

export type ProspectPriority = 'high' | 'medium' | 'low';
export type ProspectChannel = 'phone' | 'whatsapp' | 'email' | 'instagram';
export type ProspectContactResult = 'contacted' | 'noResponse' | 'reschedule' | 'discarded';

export interface ProspectConversionDraft {
  clientId: string;
  clientName: string;
  clientCompany: string;
  clientPhone: string;
  clientEmail: string;
  clientPreferredChannel: ProspectChannel | '';
  address?: string;
  origin?: string;
  opportunityId: string;
  opportunityName: string;
  serviceOfInterest: string;
  interestLevel: ProspectPriority;
  detectedNeed: string;
  estimatedValue?: number;
  nextStep: string;
  nextStepAt: string;
  nextStepChannel:
    'call' | 'whatsapp' | 'email' | 'instagram' | 'meeting' | 'waitForResponse' | 'other';
  responsible: string;
}

export interface ProspectConversion {
  state: 'pending' | 'completed';
  startedAt: string;
  completedAt?: string;
  draft: ProspectConversionDraft;
}

export interface ProspectActivity {
  id: string;
  occurredAt: string;
  prospectId?: string;
  createdAt?: string;
  type: 'statusChanged' | 'contactPrepared' | 'contactResult' | 'note' | 'conversionCompleted';
  description: string;
  author?: string;
  result?: ProspectContactResult;
  channel?: ProspectChannel;
  note?: string;
  followUpAt?: string;
  /** Follow-up date that this action replaced, when the next step was rescheduled. */
  previousFollowUpAt?: string;
}

export interface Prospect {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  instagram?: string;
  /** Dirección de la obra o referencia comercial del prospecto. */
  address?: string;
  source: string;
  potentialService: string;
  notes: string;
  status: ProspectStatus;
  priority: ProspectPriority;
  priorityReason: string;
  nextAction: string;
  nextActionAt: string;
  responsible: string;
  preferredChannel: ProspectChannel | '';
  conversion?: ProspectConversion;
  activities: ProspectActivity[];
  createdAt: string;
  updatedAt: string;
  /** Optimistic concurrency token supplied by the backend. */
  version?: number;
}

export type ProspectInput = Omit<Prospect, 'id' | 'activities' | 'createdAt' | 'updatedAt'>;
