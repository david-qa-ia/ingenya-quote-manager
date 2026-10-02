import { describe, expect, it } from 'vitest';
import { planQuotePdfPages, type QuotePdfMeasuredRow } from './quotePdfLayout';

function rows(count: number, height = 10): QuotePdfMeasuredRow[] {
  return Array.from({ length: count }, (_, index) => ({
    index,
    height,
    cells: [['Servicio'], ['Unidad'], ['1'], ['$ 1'], ['$ 1']],
  }));
}

describe('planQuotePdfPages', () => {
  it('keeps a short two-service quote on one page with its closing block', () => {
    const pages = planQuotePdfPages(rows(2), 100);

    expect(pages).toHaveLength(1);
    expect(pages[0].rows.map((row) => row.index)).toEqual([0, 1]);
    expect(pages[0].hasClosingBlock).toBe(true);
  });

  it.each([8, 9, 10, 11])(
    'plans the %i-service boundary case from measured row heights',
    (count) => {
      const pages = planQuotePdfPages(rows(count, 13), 100);
      const plannedIndexes = pages.flatMap((page) => page.rows.map((row) => row.index));

      expect(plannedIndexes).toEqual(Array.from({ length: count }, (_, index) => index));
      expect(pages.filter((page) => page.hasClosingBlock)).toHaveLength(1);
      expect(pages.at(-1)?.hasClosingBlock).toBe(true);
      expect(pages.every((page) => page.rows.length > 0)).toBe(true);
    },
  );

  it('moves complete rows to the last page so a 15-service quote can close safely', () => {
    const pages = planQuotePdfPages(rows(15), 100);
    const plannedIndexes = pages.flatMap((page) => page.rows.map((row) => row.index));

    expect(pages.length).toBeGreaterThan(1);
    expect(plannedIndexes).toEqual(Array.from({ length: 15 }, (_, index) => index));
    expect(new Set(plannedIndexes).size).toBe(15);
    expect(pages.at(-1)?.rows.length).toBeGreaterThan(0);
    expect(pages.at(-1)?.hasClosingBlock).toBe(true);
  });

  it('rejects a row that cannot fit complete on a continuation page', () => {
    expect(() => planQuotePdfPages(rows(1, 230), 100)).toThrow(
      'No se puede generar el PDF porque un servicio es demasiado extenso para una página.',
    );
  });
});
