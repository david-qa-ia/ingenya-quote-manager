export type NextActionStatus = 'pending' | 'completed' | 'cancelled';

export interface NextAction {
  description: string;
  dueDate: string;
  responsible: string;
  status: NextActionStatus;
}

export interface Opportunity {
  id: string;
  clientId: string;
  name: string;
  address: string;
  estimatedStartDate: string;
  responsibleSeller: string;
  nextAction?: NextAction;
  createdAt: string;
  updatedAt: string;
}

export type OpportunityInput = Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt'>;
