export type QuoteSidebarTab = 'summary' | 'activities' | 'commercialStatus';

export const quoteSidebarTabs: { id: QuoteSidebarTab; label: string }[] = [
  { id: 'summary', label: 'Resumen' },
  { id: 'activities', label: 'Actividades' },
  { id: 'commercialStatus', label: 'Estado comercial' },
];

export function getSidebarTabAfterKey(
  current: QuoteSidebarTab,
  key: string,
): QuoteSidebarTab | null {
  const index = quoteSidebarTabs.findIndex((tab) => tab.id === current);
  if (key === 'Home') return quoteSidebarTabs[0].id;
  if (key === 'End') return quoteSidebarTabs[quoteSidebarTabs.length - 1]?.id ?? null;
  if (key === 'ArrowRight') return quoteSidebarTabs[(index + 1) % quoteSidebarTabs.length].id;
  if (key === 'ArrowLeft')
    return quoteSidebarTabs[(index - 1 + quoteSidebarTabs.length) % quoteSidebarTabs.length].id;
  return null;
}
