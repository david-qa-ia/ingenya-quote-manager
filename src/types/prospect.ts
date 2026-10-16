export type ProspectStatus =
  | 'uncontacted'
  | 'contactToday'
  | 'contacted'
  | 'noResponse'
  | 'interested'
  | 'notInterested'
  | 'converted';

export type ProspectPriority = 'high' | 'medium' | 'low';
export type ProspectChannel = 'phone' | 'whatsapp' | 'email';
export type ProspectContactResult = 'contacted' | 'noResponse' | 'reschedule' | 'discarded';

export interface ProspectConversionDraft {
  clientId: string;
  clientName: string;
  clientCompany: string;
  clientPhone: string;
  clientEmail: string;
  clientPreferredChannel: ProspectChannel | '';
  opportunityId: string;
  opportunityName: string;
  serviceOfInterest: string;
  interestLevel: ProspectPriority;
  detectedNeed: string;
  estimatedValue?: number;
  nextStep: string;
  nextStepAt: string;
  nextStepChannel: 'call' | 'whatsapp' | 'email' | 'meeting' | 'waitForResponse' | 'other';
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
}

export interface Prospect {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
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
}

export type ProspectInput = Omit<Prospect, 'id' | 'activities' | 'createdAt' | 'updatedAt'>;
