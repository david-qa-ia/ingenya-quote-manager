export type AppView =
  | 'jobs'
  | 'clients'
  | 'today'
  | 'editor'
  | 'summary'
  | 'savedQuotes'
  | 'catalog'
  | 'cadences'
  | 'metrics'
  | 'prospects'
  | 'opportunityDetail'
  | 'quoteDetail'
  | 'settings';
export type NavigationSection =
  'today' | 'jobs' | 'clients' | 'newQuote' | 'savedQuotes' | 'settings' | 'none';

export function resolveActiveNavigationSection(view: AppView): NavigationSection {
  if (view === 'jobs' || view === 'prospects') return 'jobs';
  if (view === 'clients') return 'clients';
  if (view === 'settings' || view === 'catalog') return 'settings';
  if (view === 'today' || view === 'cadences' || view === 'metrics') return 'today';
  if (view === 'savedQuotes') return 'savedQuotes';
  // A detail belongs to the list it was opened from, so no menu item claims it.
  if (view === 'opportunityDetail' || view === 'quoteDetail') return 'none';
  return 'newQuote';
}

/**
 * Lists an opportunity can be opened from, directly or through one of its quotes; "Volver" in
 * its detail returns there.
 */
export type OpportunityOrigin = 'today' | 'jobs' | 'clients' | 'prospects' | 'savedQuotes';

const opportunityOrigins: readonly AppView[] = [
  'today',
  'jobs',
  'clients',
  'prospects',
  'savedQuotes',
];

/**
 * Where "Volver" in the opportunity detail should lead after opening it from `view`.
 * Opening it from another detail (a quote, the search over a detail) keeps the list the user
 * started from; anything else falls back to Hoy.
 */
export function resolveOpportunityOrigin(
  view: AppView,
  previous: OpportunityOrigin = 'today',
): OpportunityOrigin {
  if (opportunityOrigins.includes(view)) return view as OpportunityOrigin;
  return previous;
}

export const opportunityOriginLabels: Record<OpportunityOrigin, string> = {
  today: 'Volver a Hoy',
  jobs: 'Volver a Trabajos',
  clients: 'Volver a Clientes',
  prospects: 'Volver a Prospectos',
  savedQuotes: 'Volver a presupuestos',
};

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
  today: '#/hoy',
  jobs: '#/trabajos',
  clients: '#/clientes',
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

/** Addresses of screens merged into Hoy, kept so saved links and history still open it. */
const legacyHashes: Record<string, AppView> = {
  '#/seguimiento': 'today',
  '#/seguimiento-completo': 'today',
};

export const hashForView = (view: AppView) => viewHashes[view];

export function viewFromHash(hash: string): AppView | null {
  const entry = (Object.entries(viewHashes) as [AppView, string][]).find(
    ([, value]) => value === hash,
  );
  return entry?.[0] ?? legacyHashes[hash] ?? null;
}

/** The view to open when the page loads with this address. */
export function initialViewFromHash(hash: string): AppView {
  const view = viewFromHash(hash);
  if (view === 'quoteDetail' || view === 'summary') return 'savedQuotes';
  if (view === 'opportunityDetail') return 'today';
  return view ?? 'today';
}
