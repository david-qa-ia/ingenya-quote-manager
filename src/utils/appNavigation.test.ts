import { describe, expect, it } from 'vitest';
import {
  getCircularFocusIndex,
  hashForView,
  initialViewFromHash,
  resolveActiveNavigationSection,
  viewFromHash,
} from './appNavigation';

describe('resolveActiveNavigationSection', () => {
  it('keeps the editor and summary inside the new quote section', () => {
    expect(resolveActiveNavigationSection('editor')).toBe('newQuote');
    expect(resolveActiveNavigationSection('summary')).toBe('newQuote');
  });

  it('redirects legacy catalog and cadence views to their consolidated sections', () => {
    expect(resolveActiveNavigationSection('savedQuotes')).toBe('savedQuotes');
    expect(resolveActiveNavigationSection('catalog')).toBe('settings');
    expect(resolveActiveNavigationSection('cadences')).toBe('nextActions');
    expect(resolveActiveNavigationSection('metrics')).toBe('metrics');
    expect(resolveActiveNavigationSection('quoteDetail')).toBe('nextActions');
  });
});

describe('getCircularFocusIndex', () => {
  it('wraps forward and backward within the available controls', () => {
    expect(getCircularFocusIndex(2, 1, 3)).toBe(0);
    expect(getCircularFocusIndex(0, -1, 3)).toBe(2);
  });

  it('enters at the corresponding edge and handles an empty menu', () => {
    expect(getCircularFocusIndex(-1, 1, 3)).toBe(0);
    expect(getCircularFocusIndex(-1, -1, 3)).toBe(2);
    expect(getCircularFocusIndex(-1, 1, 0)).toBe(-1);
  });
});

describe('section addresses (SCRUM-119)', () => {
  it('maps every section to an address and back', () => {
    expect(hashForView('prospects')).toBe('#/prospectos');
    expect(viewFromHash('#/indicadores')).toBe('metrics');
    expect(viewFromHash('#/no-existe')).toBeNull();
  });

  it('reopens the list when a reload lands on a view that needs a selected record', () => {
    expect(initialViewFromHash('#/presupuesto-detalle')).toBe('savedQuotes');
    expect(initialViewFromHash('#/oportunidad')).toBe('nextActions');
    expect(initialViewFromHash('#/configuracion')).toBe('settings');
    expect(initialViewFromHash('')).toBe('dailyDashboard');
  });
});
