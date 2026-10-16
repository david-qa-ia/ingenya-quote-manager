import type { Client } from './client';
import type { Opportunity } from './opportunity';
import type { SavedQuote } from './quote';

export type GlobalSearchGroup = 'contacts' | 'opportunities' | 'quotes';

export interface GlobalSearchResult {
  id: string;
  group: GlobalSearchGroup;
  title: string;
  context: string;
  icon: 'person' | 'calendar-check' | 'document';
  client?: Client;
  opportunity?: Opportunity;
  quote?: SavedQuote;
  score: number;
}
