import { describe, expect, it } from 'vitest';
import type { DeploymentBrandConfig } from '../types/branding';
import {
  getCircularFocusIndex,
  getVisibleContactItems,
  resolveActiveNavigationSection,
} from './appNavigation';

const brand: DeploymentBrandConfig = {
  companyName: 'Empresa configurable',
  experienceMessage: ' Experiencia comprobada ',
  email: ' contacto@example.com ',
  whatsapp: { display: ' 341 555-0101 ', value: '+54 9 341 555-0101' },
  footerBusinessText: 'Empresa configurable - Servicios',
};

describe('resolveActiveNavigationSection', () => {
  it('keeps the editor and summary inside the new quote section', () => {
    expect(resolveActiveNavigationSection('editor')).toBe('newQuote');
    expect(resolveActiveNavigationSection('summary')).toBe('newQuote');
  });

  it('identifies saved quotes and catalog sections', () => {
    expect(resolveActiveNavigationSection('savedQuotes')).toBe('savedQuotes');
    expect(resolveActiveNavigationSection('catalog')).toBe('catalog');
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

describe('getVisibleContactItems', () => {
  it('normalizes configured text and creates functional contact links', () => {
    expect(getVisibleContactItems(brand)).toEqual([
      { label: 'Experiencia comprobada' },
      { label: 'contacto@example.com', href: 'mailto:contacto@example.com' },
      { label: '341 555-0101', href: 'https://wa.me/5493415550101' },
    ]);
  });

  it('omits empty optional data without leaving placeholder items', () => {
    expect(
      getVisibleContactItems({
        ...brand,
        experienceMessage: ' ',
        email: ' ',
        whatsapp: { display: ' ', value: ' ' },
      }),
    ).toEqual([]);
  });
});
