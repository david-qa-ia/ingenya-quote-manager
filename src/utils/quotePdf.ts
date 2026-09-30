import type { jsPDF as JsPdf } from 'jspdf';
import type { Quote } from '../types/quote';
import { formatCurrency } from './quoteFormatting';
import { prepareQuotePdfModel, type QuotePdfModel } from './quotePdfModel';

type JsPdfConstructor = (typeof import('jspdf'))['jsPDF'];
type JsPdfLoader = () => Promise<JsPdfConstructor>;

const PAGE_MARGIN = 15;
const PAGE_BOTTOM_MARGIN = 17;
const LINE_HEIGHT = 4.5;
const CELL_PADDING = 2.5;
const COLUMN_WIDTHS = [62, 28, 20, 35, 35] as const;

async function loadJsPdf(): Promise<JsPdfConstructor> {
  return (await import('jspdf')).jsPDF;
}

function drawPageHeader(document: JsPdf, model: QuotePdfModel): number {
  document.setFont('helvetica', 'bold');
  document.setFontSize(21);
  document.text('Presupuesto', PAGE_MARGIN, 22);

  document.setFontSize(10);
  document.text(`ID: ${model.id}`, PAGE_MARGIN, 31);
  document.setFont('helvetica', 'normal');
  document.text(`Estado: ${model.status}`, PAGE_MARGIN, 37);

  document.setDrawColor(210);
  document.line(PAGE_MARGIN, 42, 195, 42);
  document.setFontSize(10);
  document.setFont('helvetica', 'bold');
  document.text('Cliente', PAGE_MARGIN, 50);
  document.text('Obra', 108, 50);
  document.setFont('helvetica', 'normal');
  const clientLines = document.splitTextToSize(model.clientName, 82) as string[];
  const projectLines = document.splitTextToSize(model.projectName, 87) as string[];
  document.text(clientLines, PAGE_MARGIN, 56);
  document.text(projectLines, 108, 56);

  return 61 + Math.max(clientLines.length, projectLines.length) * LINE_HEIGHT;
}

function drawTableHeader(document: JsPdf, y: number): number {
  const labels = ['Servicio', 'Unidad', 'Cantidad', 'Precio unit.', 'Subtotal'];
  let x = PAGE_MARGIN;

  document.setFillColor(239, 243, 241);
  document.setDrawColor(200);
  document.setFont('helvetica', 'bold');
  document.setFontSize(8);

  labels.forEach((label, index) => {
    const width = COLUMN_WIDTHS[index];
    document.rect(x, y, width, 9, 'FD');
    document.text(label, index >= 2 ? x + width - CELL_PADDING : x + CELL_PADDING, y + 5.8, {
      maxWidth: width - CELL_PADDING * 2,
      align: index >= 2 ? 'right' : 'left',
    });
    x += width;
  });

  return y + 9;
}

function addPageWithTableHeader(document: JsPdf, model: QuotePdfModel): number {
  document.addPage();
  return drawTableHeader(document, drawPageHeader(document, model));
}

function drawRowChunk(
  document: JsPdf,
  descriptionLines: string[],
  values: readonly (string | string[])[],
  y: number,
): number {
  const valueLineCount = Math.max(
    1,
    ...values.map((value) => (Array.isArray(value) ? value.length : 1)),
  );
  const rowHeight = Math.max(
    9,
    Math.max(descriptionLines.length, valueLineCount) * LINE_HEIGHT + CELL_PADDING * 2,
  );
  let x = PAGE_MARGIN;

  document.setFont('helvetica', 'normal');
  document.setFontSize(8.5);
  COLUMN_WIDTHS.forEach((width, index) => {
    document.setDrawColor(215);
    document.rect(x, y, width, rowHeight);
    const text = index === 0 ? descriptionLines : values[index - 1] || '';
    document.text(text, index >= 2 ? x + width - CELL_PADDING : x + CELL_PADDING, y + 5.5, {
      maxWidth: width - CELL_PADDING * 2,
      align: index >= 2 ? 'right' : 'left',
    });
    x += width;
  });

  return y + rowHeight;
}

function drawQuote(document: JsPdf, model: QuotePdfModel): void {
  const pageHeight = document.internal.pageSize.getHeight();
  let y = drawTableHeader(document, drawPageHeader(document, model));

  model.lines.forEach((line) => {
    let remainingLines = document.splitTextToSize(
      line.description,
      COLUMN_WIDTHS[0] - CELL_PADDING * 2,
    ) as string[];
    let isFirstChunk = true;
    const unitLines = document.splitTextToSize(
      line.unit,
      COLUMN_WIDTHS[1] - CELL_PADDING * 2,
    ) as string[];

    while (remainingLines.length > 0) {
      const availableHeight = pageHeight - PAGE_BOTTOM_MARGIN - y;
      const minimumChunkHeight =
        (isFirstChunk ? unitLines.length : 1) * LINE_HEIGHT + CELL_PADDING * 2;

      if (availableHeight < minimumChunkHeight) {
        y = addPageWithTableHeader(document, model);
        continue;
      }

      const maxLines = Math.floor((availableHeight - CELL_PADDING * 2) / LINE_HEIGHT);

      if (maxLines < 1) {
        y = addPageWithTableHeader(document, model);
        continue;
      }

      const chunk = remainingLines.slice(0, maxLines);
      remainingLines = remainingLines.slice(maxLines);
      const values = isFirstChunk
        ? [
            unitLines,
            String(line.quantity),
            formatCurrency(line.unitPrice),
            formatCurrency(line.subtotal),
          ]
        : ['', '', '', ''];
      y = drawRowChunk(document, chunk, values, y);
      isFirstChunk = false;

      if (remainingLines.length > 0) {
        y = addPageWithTableHeader(document, model);
      }
    }
  });

  if (y + 28 > pageHeight - PAGE_BOTTOM_MARGIN) {
    document.addPage();
    y = drawPageHeader(document, model);
  }

  document.setFont('helvetica', 'bold');
  document.setFontSize(11);
  document.text('Total del presupuesto', 125, y + 10);
  document.setFontSize(14);
  document.text(formatCurrency(model.total), 195, y + 10, { align: 'right' });
  document.setFont('helvetica', 'normal');
  document.setFontSize(8.5);
  document.text('Presupuesto sujeto a revisión y confirmación.', PAGE_MARGIN, y + 22);

  const pageCount = document.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    document.setPage(pageNumber);
    document.setFontSize(8);
    document.setTextColor(100);
    document.text(`Página ${pageNumber} de ${pageCount}`, 195, pageHeight - 8, {
      align: 'right',
    });
  }
}

export async function downloadQuotePdf(
  draft: Readonly<Quote>,
  jsPdfLoader: JsPdfLoader = loadJsPdf,
): Promise<void> {
  const model = prepareQuotePdfModel(draft);
  const JsPdf = await jsPdfLoader();
  const document = new JsPdf({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  drawQuote(document, model);
  document.save(model.fileName);
}
