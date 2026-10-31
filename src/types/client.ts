export type PreferredChannel = '' | 'phone' | 'whatsapp' | 'email';

export interface DoNotContactRecord {
  reason: string;
  recordedAt: string;
  recordedBy: string;
}

export interface Client {
  id: string;
  name: string;
  company?: string;
  phone: string;
  email: string;
  preferredChannel: PreferredChannel;
  contactConsent: boolean;
  doNotContact?: DoNotContactRecord;
  createdAt: string;
  updatedAt: string;
  /** Optimistic concurrency token from Supabase (SCRUM-113); absent for local-only clients. */
  version?: number;
}

export type ClientInput = Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'version'>;
