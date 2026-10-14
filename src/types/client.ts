export type PreferredChannel = '' | 'phone' | 'whatsapp' | 'email';

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  preferredChannel: PreferredChannel;
  contactConsent: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ClientInput = Omit<Client, 'id' | 'createdAt' | 'updatedAt'>;
