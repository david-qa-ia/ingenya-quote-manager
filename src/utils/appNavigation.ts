export type AppView =
  | 'dailyDashboard'
  | 'editor'
  | 'summary'
  | 'savedQuotes'
  | 'catalog'
  | 'nextActions'
  | 'cadences'
  | 'metrics'
  | 'prospects'
  | 'opportunityDetail'
  | 'quoteDetail'
  | 'settings';
export type NavigationSection =
  'newQuote' | 'savedQuotes' | 'nextActions' | 'metrics' | 'prospects' | 'settings';

export function resolveActiveNavigationSection(view: AppView): NavigationSection {
  if (view === 'settings') return 'settings';
  if (view === 'dailyDashboard') return 'nextActions';
  if (view === 'savedQuotes') return 'savedQuotes';
  if (view === 'catalog') return 'settings';
  if (view === 'nextActions') return 'nextActions';
  if (view === 'cadences') return 'nextActions';
  if (view === 'metrics') return 'metrics';
  if (view === 'prospects') return 'prospects';
  if (view === 'opportunityDetail') return 'nextActions';
  if (view === 'quoteDetail') return 'nextActions';
  return 'newQuote';
}

export function getCircularFocusIndex(
  currentIndex: number,
  direction: 1 | -1,
  itemCount: number,
): number {
  if (itemCount <= 0) return -1;
  if (currentIndex < 0 || currentIndex >= itemCount) {
    return direction === 1 ? 0 : itemCount - 1;
  }

  return (currentIndex + direction + itemCount) % itemCount;
}
