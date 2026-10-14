export interface Opportunity {
  id: string;
  clientId: string;
  name: string;
  address: string;
  estimatedStartDate: string;
  responsibleSeller: string;
  createdAt: string;
  updatedAt: string;
}

export type OpportunityInput = Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt'>;
