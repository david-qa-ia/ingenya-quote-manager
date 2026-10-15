import type { CommercialOutcome } from '../types/commercialOutcome';
import { loadCollection, readCollection, hasRecordId } from './localCollectionStorage';
import { isCommercialOutcome } from './commercialOutcome';

export const COMMERCIAL_OUTCOMES_STORAGE_KEY = 'ingenya.commercialOutcomes.v1';

export const loadCommercialOutcomes = () =>
  loadCollection(COMMERCIAL_OUTCOMES_STORAGE_KEY, isCommercialOutcome);

export function appendCommercialOutcome(outcome: CommercialOutcome): boolean {
  try {
    if (!isCommercialOutcome(outcome)) return false;
    const records = readCollection(COMMERCIAL_OUTCOMES_STORAGE_KEY);
    const existing = records.find((item) => hasRecordId(item, outcome.id));
    if (existing) return isCommercialOutcome(existing);
    records.push(structuredClone(outcome));
    localStorage.setItem(COMMERCIAL_OUTCOMES_STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}
