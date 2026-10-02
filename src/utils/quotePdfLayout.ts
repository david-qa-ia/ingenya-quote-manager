import type { QuotePdfModel } from './quotePdfModel';

export const PDF_PAGE_WIDTH = 210;
export const PDF_PAGE_HEIGHT = 297;
export const PDF_MARGIN = 14;
export const PDF_FOOTER_TOP = 278;
export const PDF_TABLE_HEADER_HEIGHT = 9;
export const PDF_ROW_PADDING = 2.4;
export const PDF_ROW_LINE_HEIGHT = 4.2;
export const PDF_CLOSING_HEIGHT = 38;
export const PDF_CLOSING_GAP = 5;
export const PDF_CONTINUATION_TABLE_TOP = 40;
export const PDF_COLUMN_WIDTHS = [67, 28, 18, 34, 35] as const;

export interface PdfTextMeasurer {
  splitTextToSize(text: string, maxWidth: number): string[];
}

export interface QuotePdfMeasuredRow {
  readonly index: number;
  readonly cells: readonly string[][];
  readonly height: number;
}

export interface QuotePdfPagePlan {
  readonly isFirstPage: boolean;
  readonly tableTop: number;
  readonly rows: readonly QuotePdfMeasuredRow[];
  readonly hasClosingBlock: boolean;
}

export class QuotePdfLayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotePdfLayoutError';
  }
}

export function measureQuotePdfRows(
  measurer: PdfTextMeasurer,
  model: QuotePdfModel,
  formattedRows: readonly (readonly string[])[],
): QuotePdfMeasuredRow[] {
  return model.lines.map((_line, index) => {
    const cells = formattedRows[index].map((value, cellIndex) =>
      measurer.splitTextToSize(value, PDF_COLUMN_WIDTHS[cellIndex] - PDF_ROW_PADDING * 2),
    );
    const lineCount = Math.max(1, ...cells.map((cell) => cell.length));

    return {
      index,
      cells,
      height: Math.max(9, lineCount * PDF_ROW_LINE_HEIGHT + PDF_ROW_PADDING * 2),
    };
  });
}

function rowsHeight(rows: readonly QuotePdfMeasuredRow[]): number {
  return rows.reduce((total, row) => total + row.height, 0);
}

function rowsBottom(page: Pick<QuotePdfPagePlan, 'tableTop' | 'rows'>): number {
  return page.tableTop + PDF_TABLE_HEADER_HEIGHT + rowsHeight(page.rows);
}

export function planQuotePdfPages(
  rows: readonly QuotePdfMeasuredRow[],
  firstPageTableTop: number,
): QuotePdfPagePlan[] {
  const normalBottom = PDF_FOOTER_TOP - PDF_CLOSING_GAP;
  const continuationCapacity = normalBottom - PDF_CONTINUATION_TABLE_TOP - PDF_TABLE_HEADER_HEIGHT;

  for (const row of rows) {
    if (row.height > continuationCapacity) {
      throw new QuotePdfLayoutError(
        'No se puede generar el PDF porque un servicio es demasiado extenso para una página.',
      );
    }
  }

  const pages: Array<{
    isFirstPage: boolean;
    tableTop: number;
    rows: QuotePdfMeasuredRow[];
    hasClosingBlock: boolean;
  }> = [
    {
      isFirstPage: true,
      tableTop: firstPageTableTop,
      rows: [],
      hasClosingBlock: false,
    },
  ];

  for (const row of rows) {
    let currentPage = pages.at(-1)!;
    const rowBottom = rowsBottom(currentPage) + row.height;

    if (rowBottom > normalBottom) {
      currentPage = {
        isFirstPage: false,
        tableTop: PDF_CONTINUATION_TABLE_TOP,
        rows: [],
        hasClosingBlock: false,
      };
      pages.push(currentPage);
    }

    currentPage.rows.push(row);
  }

  const closingTop = PDF_FOOTER_TOP - PDF_CLOSING_HEIGHT;
  const lastPage = pages.at(-1)!;

  if (rowsBottom(lastPage) <= closingTop - PDF_CLOSING_GAP) {
    lastPage.hasClosingBlock = true;
    return pages;
  }

  const finalPage = {
    isFirstPage: false,
    tableTop: PDF_CONTINUATION_TABLE_TOP,
    rows: [] as QuotePdfMeasuredRow[],
    hasClosingBlock: true,
  };
  pages.push(finalPage);

  let sourcePageIndex = pages.length - 2;
  while (sourcePageIndex >= 0) {
    const sourcePage = pages[sourcePageIndex];
    const candidate = sourcePage.rows.at(-1);

    if (!candidate) {
      if (pages.length > 2) {
        pages.splice(sourcePageIndex, 1);
        sourcePageIndex -= 1;
        continue;
      }
      break;
    }

    const proposedFinalRows = [candidate, ...finalPage.rows];
    const proposedFinalBottom =
      finalPage.tableTop + PDF_TABLE_HEADER_HEIGHT + rowsHeight(proposedFinalRows);
    if (proposedFinalBottom > closingTop - PDF_CLOSING_GAP) break;

    sourcePage.rows.pop();
    finalPage.rows.unshift(candidate);

    if (
      finalPage.rows.length > 0 &&
      rowsBottom(sourcePage) <= normalBottom &&
      sourcePage.rows.length > 0
    ) {
      break;
    }
  }

  return pages;
}
