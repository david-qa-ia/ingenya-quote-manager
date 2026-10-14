import type { Opportunity } from '../types/opportunity';
import { loadClients } from './clientStorage';
import { isOpportunity, normalizeOpportunityInput } from './opportunityValidation';
import { loadCollection, saveCollectionItem } from './localCollectionStorage';

export const OPPORTUNITIES_STORAGE_KEY = 'ingenya.opportunities.v1';
export const loadOpportunities = () => loadCollection(OPPORTUNITIES_STORAGE_KEY, isOpportunity);

export function saveOpportunity(opportunity: Opportunity): boolean {
  if (
    !isOpportunity(opportunity) ||
    !loadClients().items.some((client) => client.id === opportunity.clientId)
  )
    return false;
  const existing = loadOpportunities().items.find((item) => item.id === opportunity.id);
  if (existing && existing.clientId !== opportunity.clientId) return false;
  return saveCollectionItem(
    OPPORTUNITIES_STORAGE_KEY,
    {
      ...normalizeOpportunityInput(opportunity),
      id: opportunity.id,
      createdAt: opportunity.createdAt,
      updatedAt: opportunity.updatedAt,
    },
    isOpportunity,
  );
}
