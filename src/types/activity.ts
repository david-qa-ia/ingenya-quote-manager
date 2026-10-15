import type { ContactCommunicationSnapshot, WhatsAppResult } from './contactScript';

export type ActivityType = 'call' | 'whatsapp' | 'email' | 'note' | 'relevantChange';

export type CallResult =
  'effectiveContact' | 'noAnswer' | 'callBack' | 'notInterested' | 'invalidNumber';

export type ActivitySubject =
  | { kind: 'client'; clientId: string }
  | { kind: 'opportunity'; opportunityId: string }
  | { kind: 'quote'; quoteId: string };

export type AutomaticActivityEvent =
  | 'created'
  | 'finalized'
  | 'pdfGenerated'
  | 'commercialStatusChanged'
  | 'nextActionChanged'
  | 'cadenceChanged'
  | 'commercialOutcomeChanged';

export interface ActivityNoteRevision {
  editedAt: string;
  editedBy: string;
  note: string;
}

export interface Activity {
  id: string;
  type: ActivityType;
  occurredAt: string;
  author: string;
  result: string;
  note: string;
  subject: ActivitySubject;
  source: 'manual' | 'automatic';
  event?: AutomaticActivityEvent;
  noteRevisions: ActivityNoteRevision[];
  communication?: ContactCommunicationSnapshot;
}

export type CommunicationResult = CallResult | WhatsAppResult;

export interface ActivityInput {
  type: ActivityType;
  occurredAt: string;
  author: string;
  result: string;
  note: string;
}
