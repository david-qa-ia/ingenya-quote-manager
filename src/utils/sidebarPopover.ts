import { useLayoutEffect, type RefObject } from 'react';

/**
 * SCRUM-128: on desktop the navigation rail scrolls (SCRUM-119), so anything it opens to its
 * right (workspace list, search) would be clipped by it. Those panels are placed with
 * `position: fixed` next to the rail instead, at the height of the button that opened them and
 * kept inside the window.
 */

export const SIDEBAR_POPOVER_GAP = 12;
const DESKTOP_QUERY = '(min-width: 801px)';

export interface SidebarPopoverPlacement {
  top: number;
  left: number;
}

export function placeSidebarPopover(input: {
  anchorTop: number;
  railRight: number;
  popoverHeight: number;
  viewportHeight: number;
  gap?: number;
}): SidebarPopoverPlacement {
  const gap = input.gap ?? SIDEBAR_POPOVER_GAP;
  const lowestTop = input.viewportHeight - input.popoverHeight - gap;
  return {
    left: Math.round(input.railRight + gap),
    top: Math.round(Math.max(gap, Math.min(input.anchorTop, lowestTop))),
  };
}

export function useSidebarPopover(
  anchorRef: RefObject<HTMLElement | null>,
  popoverRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
) {
  useLayoutEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;
    const media = window.matchMedia?.(DESKTOP_QUERY);

    function place() {
      const anchor = anchorRef.current;
      const popover = popoverRef.current;
      if (!anchor || !popover) return;
      if (!media?.matches) {
        popover.style.removeProperty('--sidebar-popover-top');
        popover.style.removeProperty('--sidebar-popover-left');
        return;
      }
      const anchorRect = anchor.getBoundingClientRect();
      const rail = anchor.closest('.app-sidebar-header');
      const placement = placeSidebarPopover({
        anchorTop: anchorRect.top,
        railRight: rail ? rail.getBoundingClientRect().right : anchorRect.right,
        popoverHeight: popover.offsetHeight,
        viewportHeight: window.innerHeight,
      });
      popover.style.setProperty('--sidebar-popover-top', `${placement.top}px`);
      popover.style.setProperty('--sidebar-popover-left', `${placement.left}px`);
    }

    place();
    window.addEventListener('resize', place);
    document.addEventListener('scroll', place, true);
    media?.addEventListener?.('change', place);
    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => place());
    if (popoverRef.current) resizeObserver?.observe(popoverRef.current);
    return () => {
      window.removeEventListener('resize', place);
      document.removeEventListener('scroll', place, true);
      media?.removeEventListener?.('change', place);
      resizeObserver?.disconnect();
    };
  }, [anchorRef, popoverRef, isOpen]);
}
