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

/**
 * SCRUM-119: each section has its own address, so the browser back button and a reload keep
 * the user where they were. Views that need a selected record (a quote or an opportunity)
 * reopen their list after a reload, because that selection is not part of the address.
 */
const viewHashes: Record<AppView, string> = {
  dailyDashboard: '#/seguimiento',
  nextActions: '#/seguimiento-completo',
  cadences: '#/automatizaciones',
  prospects: '#/prospectos',
  savedQuotes: '#/presupuestos',
  editor: '#/nuevo-presupuesto',
  summary: '#/presupuesto',
  quoteDetail: '#/presupuesto-detalle',
  opportunityDetail: '#/oportunidad',
  metrics: '#/indicadores',
  settings: '#/configuracion',
  catalog: '#/servicios',
};

export const hashForView = (view: AppView) => viewHashes[view];

export function viewFromHash(hash: string): AppView | null {
  const entry = (Object.entries(viewHashes) as [AppView, string][]).find(
    ([, value]) => value === hash,
  );
  return entry?.[0] ?? null;
}

/** The view to open when the page loads with this address. */
export function initialViewFromHash(hash: string): AppView {
  const view = viewFromHash(hash);
  if (view === 'quoteDetail' || view === 'summary') return 'savedQuotes';
  if (view === 'opportunityDetail') return 'nextActions';
  return view ?? 'dailyDashboard';
}
