import type { Client } from './client';
import type { Opportunity } from './opportunity';
import type { Prospect } from './prospect';
import type { SavedQuote } from './quote';

export type GlobalSearchGroup = 'prospects' | 'contacts' | 'opportunities' | 'quotes';

export interface GlobalSearchResult {
  id: string;
  group: GlobalSearchGroup;
  title: string;
  context: string;
  icon: 'users' | 'person' | 'calendar-check' | 'document';
  client?: Client;
  prospect?: Prospect;
  opportunity?: Opportunity;
  quote?: SavedQuote;
  score: number;
}
