import { describe, expect, it } from 'vitest';
import { formatNumberInput, parseLocaleNumber } from './localeNumber';

describe('parseLocaleNumber (SCRUM-117)', () => {
  it.each([
    ['12,5', 12.5],
    ['120.000', 120000],
    ['1.250,50', 1250.5],
    ['1.250.000', 1250000],
    ['30000', 30000],
    ['12.5', 12.5],
    ['1,250.50', 1250.5],
    ['0,5', 0.5],
    ['0.125', 0.125],
    [',5', 0.5],
    ['$ 30.000', 30000],
    [' 15 000 ', 15000],
    ['-3', -3],
    ['1.250', 1250],
  ])('reads %s as %s', (text, expected) => {
    expect(parseLocaleNumber(text)).toBe(expected);
  });

  it.each(['', '   ', 'abc', '12.34.5', '1,2,3', '1.25,5.0', '12a', '.', ','])(
    'rejects %j instead of guessing',
    (text) => {
      expect(parseLocaleNumber(text)).toBeNull();
    },
  );

  it('keeps the quote total of the usability case: 12,5 m² at $30.000', () => {
    const quantity = parseLocaleNumber('12,5')!;
    const unitPrice = parseLocaleNumber('30.000')!;
    expect(quantity * unitPrice).toBe(375000);
  });
});

describe('formatNumberInput', () => {
  it('formats values the way they are typed and parses back to the same number', () => {
    for (const value of [12.5, 30000, 1250.5, 0.125, 1, 120000]) {
      const text = formatNumberInput(value);
      expect(parseLocaleNumber(text)).toBe(value);
    }
    expect(formatNumberInput(12.5)).toBe('12,5');
    expect(formatNumberInput(120000)).toBe('120.000');
  });

  it('returns an empty string for missing values', () => {
    expect(formatNumberInput(undefined)).toBe('');
    expect(formatNumberInput(Number.NaN)).toBe('');
  });
});
