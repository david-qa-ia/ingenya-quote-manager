import { describe, expect, it } from 'vitest';
import { getCircularFocusIndex, resolveActiveNavigationSection } from './appNavigation';

describe('resolveActiveNavigationSection', () => {
  it('keeps the editor and summary inside the new quote section', () => {
    expect(resolveActiveNavigationSection('editor')).toBe('newQuote');
    expect(resolveActiveNavigationSection('summary')).toBe('newQuote');
  });

  it('identifies saved quotes and catalog sections', () => {
    expect(resolveActiveNavigationSection('savedQuotes')).toBe('savedQuotes');
    expect(resolveActiveNavigationSection('catalog')).toBe('catalog');
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
