/**
 * Page plan of the quote PDF (A4, millimetres). The services table flows across pages; after it
 * come the document blocks (total, conditions, acceptance) in order, each one kept whole. The
 * total never starts a page alone: if it does not fit after the last service, that service moves
 * with it, so the amount always sits right below the table.
 */
export const PDF_PAGE_WIDTH = 210;
export const PDF_PAGE_HEIGHT = 297;
export const PDF_MARGIN = 16;
export const PDF_CONTENT_WIDTH = PDF_PAGE_WIDTH - PDF_MARGIN * 2;
export const PDF_FOOTER_TOP = 280;
export const PDF_TABLE_HEADER_HEIGHT = 8;
export const PDF_ROW_PADDING = 2.6;
export const PDF_CONTINUATION_TABLE_TOP = 34;
export const PDF_BLOCK_GAP = 7;
export const PDF_BOTTOM_GAP = 4;
/** Servicio, Cantidad, Precio unitario, Importe. */
export const PDF_COLUMN_WIDTHS = [94, 24, 30, 30] as const;

export interface QuotePdfMeasuredRow {
  readonly index: number;
  readonly height: number;
}

export interface QuotePdfBlock {
  readonly key: string;
  readonly height: number;
}

export interface QuotePdfPlacedBlock {
  readonly key: string;
  readonly top: number;
}

export interface QuotePdfPagePlan {
  readonly isFirstPage: boolean;
  readonly tableTop: number;
  readonly rows: readonly QuotePdfMeasuredRow[];
  readonly blocks: readonly QuotePdfPlacedBlock[];
}

export class QuotePdfLayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotePdfLayoutError';
  }
}

interface MutablePage {
  isFirstPage: boolean;
  tableTop: number;
  rows: QuotePdfMeasuredRow[];
  blocks: QuotePdfPlacedBlock[];
}

const contentBottom = PDF_FOOTER_TOP - PDF_BOTTOM_GAP;

const rowsBottom = (page: MutablePage) =>
  page.tableTop +
  (page.rows.length ? PDF_TABLE_HEADER_HEIGHT : 0) +
  page.rows.reduce((total, row) => total + row.height, 0);

const continuationPage = (): MutablePage => ({
  isFirstPage: false,
  tableTop: PDF_CONTINUATION_TABLE_TOP,
  rows: [],
  blocks: [],
});

export function planQuotePdfPages(
  rows: readonly QuotePdfMeasuredRow[],
  firstPageTableTop: number,
  blocks: readonly QuotePdfBlock[],
): QuotePdfPagePlan[] {
  const pageCapacity = contentBottom - PDF_CONTINUATION_TABLE_TOP;
  if (rows.some((row) => row.height + PDF_TABLE_HEADER_HEIGHT > pageCapacity)) {
    throw new QuotePdfLayoutError(
      'No se puede generar el PDF porque un servicio es demasiado extenso para una página.',
    );
  }
  if (blocks.some((block) => block.height > pageCapacity)) {
    throw new QuotePdfLayoutError(
      'No se puede generar el PDF porque las condiciones son demasiado extensas para una página.',
    );
  }

  const pages: MutablePage[] = [
    { isFirstPage: true, tableTop: firstPageTableTop, rows: [], blocks: [] },
  ];

  for (const row of rows) {
    let page = pages.at(-1)!;
    const headerHeight = page.rows.length ? 0 : PDF_TABLE_HEADER_HEIGHT;
    if (rowsBottom(page) + headerHeight + row.height > contentBottom) {
      page = continuationPage();
      pages.push(page);
    }
    page.rows.push(row);
  }

  let page = pages.at(-1)!;
  let cursor = rowsBottom(page) + PDF_BLOCK_GAP;
  blocks.forEach((block, blockIndex) => {
    if (cursor + block.height <= contentBottom) {
      page.blocks.push({ key: block.key, top: cursor });
      cursor += block.height + PDF_BLOCK_GAP;
      return;
    }
    const next = continuationPage();
    // The first block (the total) takes the last service with it when that leaves rows behind.
    const lastRow = page.rows.at(-1);
    const fitsWithLastRow =
      lastRow &&
      PDF_CONTINUATION_TABLE_TOP +
        PDF_TABLE_HEADER_HEIGHT +
        lastRow.height +
        PDF_BLOCK_GAP +
        block.height <=
        contentBottom;
    if (blockIndex === 0 && page.rows.length > 1 && fitsWithLastRow)
      next.rows.push(page.rows.pop()!);
    pages.push(next);
    page = next;
    cursor = rowsBottom(page) + (page.rows.length ? PDF_BLOCK_GAP : 0);
    page.blocks.push({ key: block.key, top: cursor });
    cursor += block.height + PDF_BLOCK_GAP;
  });

  return pages;
}
