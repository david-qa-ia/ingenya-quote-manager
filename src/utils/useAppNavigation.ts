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
  const replacingRef = useRef(false);

  useEffect(() => {
    const hash = hashForView(currentView);
    const fromHistory = navigatingFromHistoryRef.current;
    const replacing = replacingRef.current;
    navigatingFromHistoryRef.current = false;
    replacingRef.current = false;
    if (window.location.hash === hash) return;
    if (fromHistory || replacing || !window.location.hash)
      window.history.replaceState(null, '', hash);
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

  /**
   * Shows `view` in place of the current screen, without a new history entry: the browser back
   * button skips the screen that was replaced (a prospect file that became an opportunity).
   */
  const replaceView = useCallback((view: AppView) => {
    replacingRef.current = true;
    setCurrentView(view);
  }, []);

  return {
    currentView,
    setCurrentView,
    replaceView,
    opportunityOrigin,
    rememberOpportunityOrigin,
  };
}
