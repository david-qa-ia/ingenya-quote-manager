import { useCallback, useEffect, useRef, useState } from 'react';
import {
  hashForView,
  initialViewFromHash,
  resolveOpportunityOrigin,
  viewFromHash,
  type AppView,
  type OpportunityOrigin,
} from './appNavigation';

/**
 * The open screen, kept in step with the address (SCRUM-119) so back/forward and reload work,
 * and the list an opportunity was opened from, so "Volver" in its detail returns there.
 */
export function useAppNavigation() {
  const [currentView, setCurrentView] = useState<AppView>(() =>
    initialViewFromHash(typeof window === 'undefined' ? '' : window.location.hash),
  );
  const [opportunityOrigin, setOpportunityOrigin] = useState<OpportunityOrigin>('today');
  const navigatingFromHistoryRef = useRef(false);

  useEffect(() => {
    const hash = hashForView(currentView);
    const fromHistory = navigatingFromHistoryRef.current;
    navigatingFromHistoryRef.current = false;
    if (window.location.hash === hash) return;
    if (fromHistory || !window.location.hash) window.history.replaceState(null, '', hash);
    else window.history.pushState(null, '', hash);
  }, [currentView]);

  useEffect(() => {
    const onPopState = () => {
      const view = viewFromHash(window.location.hash);
      if (!view) return;
      navigatingFromHistoryRef.current = true;
      setCurrentView(view);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  /** Call before leaving the current screen for an opportunity or one of its quotes. */
  const rememberOpportunityOrigin = useCallback(
    () => setOpportunityOrigin((previous) => resolveOpportunityOrigin(currentView, previous)),
    [currentView],
  );

  return { currentView, setCurrentView, opportunityOrigin, rememberOpportunityOrigin };
}
