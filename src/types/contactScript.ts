export type ContactChannel = 'call' | 'whatsapp';

export type ContactScriptVariable =
  | 'cliente'
  | 'oportunidad'
  | 'servicio'
  | 'presupuesto'
  | 'total'
  | 'responsable'
  | 'proximaAccion';

export interface ContactScriptTemplate {
  id: string;
  name: string;
  channel: ContactChannel;
  content: string;
  variables: ContactScriptVariable[];
  status: 'active' | 'archived';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export type WhatsAppResult =
  | 'messagePrepared'
  | 'messageCopied'
  | 'responseReceived'
  | 'noResponse'
  | 'invalidNumber'
  | 'notInterested';

export interface ContactCommunicationSnapshot {
  channel: ContactChannel;
  templateId?: string;
  templateVersion?: number;
  templateName?: string;
  preparedContent: string;
  finalContent: string;
  copyState: 'notCopied' | 'copied';
  origin:
    | { kind: 'manual' }
    | {
        kind: 'cadence';
        cadenceExecutionId: string;
        stepExecutionId: string;
        templateStepId: string;
      };
}
