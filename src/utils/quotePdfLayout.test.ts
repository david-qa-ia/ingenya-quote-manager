import { describe, expect, it } from 'vitest';
import {
  PDF_CONTINUATION_TABLE_TOP,
  PDF_FOOTER_TOP,
  planQuotePdfPages,
  type QuotePdfBlock,
  type QuotePdfMeasuredRow,
  type QuotePdfPagePlan,
} from './quotePdfLayout';

function rows(count: number, height = 10): QuotePdfMeasuredRow[] {
  return Array.from({ length: count }, (_, index) => ({ index, height }));
}

const blocks: QuotePdfBlock[] = [
  { key: 'total', height: 13 },
  { key: 'conditions', height: 20 },
  { key: 'acceptance', height: 40 },
];

const plannedIndexes = (pages: readonly QuotePdfPagePlan[]) =>
  pages.flatMap((page) => page.rows.map((row) => row.index));

const placedBlocks = (pages: readonly QuotePdfPagePlan[]) =>
  pages.flatMap((page, pageIndex) => page.blocks.map((block) => ({ ...block, pageIndex })));

describe('planQuotePdfPages', () => {
  it('puts the total right below a short table, then conditions and acceptance', () => {
    const pages = planQuotePdfPages(rows(1), 100, blocks);

    expect(pages).toHaveLength(1);
    expect(pages[0].blocks.map((block) => block.key)).toEqual([
      'total',
      'conditions',
      'acceptance',
    ]);
    // Table header (8) + one row (10) + gap (7): the total does not drift to the page bottom.
    expect(pages[0].blocks[0].top).toBe(125);
  });

  it.each([8, 12, 15, 30])('plans %i services once each, in order, before the blocks', (count) => {
    const pages = planQuotePdfPages(rows(count, 13), 100, blocks);

    expect(plannedIndexes(pages)).toEqual(Array.from({ length: count }, (_, index) => index));
    expect(placedBlocks(pages).map((block) => block.key)).toEqual([
      'total',
      'conditions',
      'acceptance',
    ]);
    const lastRowPage = pages.findLastIndex((page) => page.rows.length > 0);
    expect(placedBlocks(pages)[0].pageIndex).toBe(lastRowPage);
  });

  it('never places a block over the footer', () => {
    for (let count = 1; count <= 25; count += 1) {
      const pages = planQuotePdfPages(rows(count, 17), 110, blocks);
      for (const block of placedBlocks(pages)) {
        const height = blocks.find((item) => item.key === block.key)!.height;
        expect(block.top + height).toBeLessThanOrEqual(PDF_FOOTER_TOP);
      }
    }
  });

  it('moves the last service with the total instead of leaving the total alone on a page', () => {
    // 14 rows of 15mm fill the first page up to the point where the total no longer fits.
    const pages = planQuotePdfPages(rows(14, 15), 50, blocks);
    const totalPage = pages[placedBlocks(pages)[0].pageIndex];

    expect(totalPage.rows.length).toBeGreaterThan(0);
    expect(totalPage.tableTop).toBe(PDF_CONTINUATION_TABLE_TOP);
  });

  it('rejects a service that cannot fit complete on a page', () => {
    expect(() => planQuotePdfPages(rows(1, 240), 100, blocks)).toThrow(
      'No se puede generar el PDF porque un servicio es demasiado extenso para una página.',
    );
  });
});
