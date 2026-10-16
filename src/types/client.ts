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
}

export type ClientInput = Omit<Client, 'id' | 'createdAt' | 'updatedAt'>;
