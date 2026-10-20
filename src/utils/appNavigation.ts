import type { DeploymentBrandConfig } from '../types/branding';

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
  | 'newQuote'
  | 'savedQuotes'
  | 'catalog'
  | 'nextActions'
  | 'cadences'
  | 'metrics'
  | 'prospects'
  | 'settings';

export interface ContactItem {
  readonly label: string;
  readonly href?: string;
}

export function resolveActiveNavigationSection(view: AppView): NavigationSection {
  if (view === 'settings') return 'settings';
  if (view === 'dailyDashboard') return 'nextActions';
  if (view === 'savedQuotes') return 'savedQuotes';
  if (view === 'catalog') return 'catalog';
  if (view === 'nextActions') return 'nextActions';
  if (view === 'cadences') return 'cadences';
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

export function getVisibleContactItems(brand: DeploymentBrandConfig): ContactItem[] {
  const experienceMessage = brand.experienceMessage?.trim();
  const email = brand.email.trim();
  const whatsappDisplay = brand.whatsapp.display.trim();
  const whatsappValue = brand.whatsapp.value.replace(/\D/g, '');

  return [
    experienceMessage ? { label: experienceMessage } : null,
    email ? { label: email, href: `mailto:${email}` } : null,
    whatsappDisplay && whatsappValue
      ? { label: whatsappDisplay, href: `https://wa.me/${whatsappValue}` }
      : null,
  ].filter((item): item is ContactItem => item !== null);
}
