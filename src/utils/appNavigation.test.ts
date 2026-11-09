import { describe, expect, it } from 'vitest';
import {
  getCircularFocusIndex,
  hashForView,
  initialViewFromHash,
  opportunityOriginLabels,
  resolveActiveNavigationSection,
  resolveOpportunityOrigin,
  viewFromHash,
} from './appNavigation';

describe('resolveActiveNavigationSection', () => {
  it('keeps the editor and summary inside the new quote section', () => {
    expect(resolveActiveNavigationSection('editor')).toBe('newQuote');
    expect(resolveActiveNavigationSection('summary')).toBe('newQuote');
  });

  it('groups the menu into Hoy, Trabajos and Clientes', () => {
    expect(resolveActiveNavigationSection('today')).toBe('today');
    expect(resolveActiveNavigationSection('metrics')).toBe('today');
    expect(resolveActiveNavigationSection('cadences')).toBe('today');
    expect(resolveActiveNavigationSection('prospects')).toBe('jobs');
    expect(resolveActiveNavigationSection('clients')).toBe('clients');
    expect(resolveActiveNavigationSection('savedQuotes')).toBe('savedQuotes');
    expect(resolveActiveNavigationSection('catalog')).toBe('settings');
  });

  it('does not mark a menu item while a detail is open', () => {
    expect(resolveActiveNavigationSection('opportunityDetail')).toBe('none');
    expect(resolveActiveNavigationSection('quoteDetail')).toBe('none');
  });
});

describe('resolveOpportunityOrigin', () => {
  it('returns to the list the opportunity was opened from', () => {
    expect(resolveOpportunityOrigin('jobs')).toBe('jobs');
    expect(resolveOpportunityOrigin('clients', 'jobs')).toBe('clients');
    expect(resolveOpportunityOrigin('prospects')).toBe('prospects');
    expect(opportunityOriginLabels[resolveOpportunityOrigin('clients')]).toBe('Volver a Clientes');
  });

  it('keeps the original list when it is opened again from a quote or another detail', () => {
    expect(resolveOpportunityOrigin('quoteDetail', 'clients')).toBe('clients');
    expect(resolveOpportunityOrigin('opportunityDetail', 'jobs')).toBe('jobs');
  });

  it('falls back to Hoy when the screen is not a list', () => {
    expect(resolveOpportunityOrigin('editor')).toBe('today');
    expect(resolveOpportunityOrigin('metrics')).toBe('today');
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
    expect(hashForView('today')).toBe('#/hoy');
    expect(viewFromHash('#/indicadores')).toBe('metrics');
    expect(viewFromHash('#/no-existe')).toBeNull();
  });

  it('opens Hoy from the addresses of the follow-up screens it replaced', () => {
    expect(viewFromHash('#/seguimiento')).toBe('today');
    expect(viewFromHash('#/seguimiento-completo')).toBe('today');
  });

  it('reopens the list when a reload lands on a view that needs a selected record', () => {
    expect(initialViewFromHash('#/presupuesto-detalle')).toBe('savedQuotes');
    expect(initialViewFromHash('#/oportunidad')).toBe('today');
    expect(initialViewFromHash('#/configuracion')).toBe('settings');
    expect(initialViewFromHash('#/clientes')).toBe('clients');
    expect(initialViewFromHash('')).toBe('today');
  });
});
