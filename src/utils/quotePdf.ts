import type { jsPDF as JsPdf } from 'jspdf';
import { deploymentBrand } from '../config/deploymentBrand';
import type { DeploymentBrandConfig } from '../types/branding';
import type { Quote } from '../types/quote';
import { formatCurrency, formatQuantity } from './quoteFormatting';
import {
  PDF_CLOSING_HEIGHT,
  PDF_COLUMN_WIDTHS,
  PDF_FOOTER_TOP,
  PDF_MARGIN,
  PDF_PAGE_WIDTH,
  PDF_ROW_PADDING,
  PDF_TABLE_HEADER_HEIGHT,
  measureQuotePdfRows,
  planQuotePdfPages,
  type QuotePdfPagePlan,
} from './quotePdfLayout';
import { prepareQuotePdfModel, type QuotePdfModel } from './quotePdfModel';

type JsPdfConstructor = (typeof import('jspdf'))['jsPDF'];
type JsPdfLoader = () => Promise<JsPdfConstructor>;

const FONT_NAME = 'Lato';
const CONTENT_WIDTH = PDF_PAGE_WIDTH - PDF_MARGIN * 2;
const BODY_COLOR = [35, 43, 39] as const;
const MUTED_COLOR = [91, 101, 96] as const;
const ACCENT_COLOR = [50, 82, 68] as const;
const LIGHT_FILL = [235, 240, 237] as const;
const BORDER_COLOR = [205, 214, 209] as const;
const ACTION_MESSAGE = 'Confirmá el presupuesto por WhatsApp para coordinar la fecha de inicio.';

async function loadJsPdf(): Promise<JsPdfConstructor> {
  return (await import('jspdf')).jsPDF;
}

function fontBase64(dataUrl: string): string {
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
}

async function registerFonts(document: JsPdf): Promise<void> {
  const [{ default: regularFontDataUrl }, { default: boldFontDataUrl }] = await Promise.all([
    import('../assets/fonts/Lato-Regular.ttf?inline'),
    import('../assets/fonts/Lato-Bold.ttf?inline'),
  ]);
  document.addFileToVFS('Lato-Regular.ttf', fontBase64(regularFontDataUrl));
  document.addFileToVFS('Lato-Bold.ttf', fontBase64(boldFontDataUrl));
  document.addFont('Lato-Regular.ttf', FONT_NAME, 'normal');
  document.addFont('Lato-Bold.ttf', FONT_NAME, 'bold');
  document.setFont(FONT_NAME, 'normal');
}

function setTextColor(document: JsPdf, color: readonly [number, number, number]): void {
  document.setTextColor(color[0], color[1], color[2]);
}

function splitText(document: JsPdf, text: string, width: number): string[] {
  return document.splitTextToSize(text, width) as string[];
}

function drawOptionalLogo(document: JsPdf, model: QuotePdfModel): number {
  if (!model.brand.logo) return PDF_MARGIN;

  const maxWidth = 24;
  const maxHeight = 18;
  const properties = document.getImageProperties(model.brand.logo.dataUrl);
  const scale = Math.min(maxWidth / properties.width, maxHeight / properties.height);
  const width = properties.width * scale;
  const height = properties.height * scale;
  document.addImage(
    model.brand.logo.dataUrl,
    model.brand.logo.format,
    PDF_MARGIN,
    12,
    width,
    height,
  );
  return PDF_MARGIN + width + 6;
}

function drawBrandHeader(document: JsPdf, model: QuotePdfModel): void {
  const textX = drawOptionalLogo(document, model);
  setTextColor(document, BODY_COLOR);
  document.setFont(FONT_NAME, 'bold');
  document.setFontSize(16);
  document.text(model.brand.companyName, textX, 18);

  document.setFont(FONT_NAME, 'normal');
  document.setFontSize(8.8);
  if (model.brand.experienceMessage?.trim()) {
    document.text(model.brand.experienceMessage.trim(), textX, 25);
  }
  setTextColor(document, MUTED_COLOR);
  document.setFontSize(8.2);
  document.text(`${model.brand.email}  |  WhatsApp ${model.brand.whatsapp.display}`, textX, 32);

  document.setDrawColor(...BORDER_COLOR);
  document.line(PDF_MARGIN, 38, PDF_PAGE_WIDTH - PDF_MARGIN, 38);
}

function firstPageTableTop(document: JsPdf, model: QuotePdfModel): number {
  document.setFont(FONT_NAME, 'bold');
  document.setFontSize(14);
  const titleLines = splitText(document, model.proposalTitle, CONTENT_WIDTH);
  document.setFont(FONT_NAME, 'normal');
  document.setFontSize(8.8);
  const clientLines = splitText(document, model.clientName, 83);
  const projectLines = splitText(document, model.projectName, 83);
  return 82 + titleLines.length * 5.7 + Math.max(clientLines.length, projectLines.length) * 4.2;
}

function drawStatus(document: JsPdf, model: QuotePdfModel): void {
  const label = model.isDraft ? 'BORRADOR - NO ES DEFINITIVO' : 'FINALIZADO';
  document.setFont(FONT_NAME, 'bold');
  document.setFontSize(model.isDraft ? 8.2 : 8);
  if (model.isDraft) {
    document.setFillColor(247, 237, 215);
    document.setDrawColor(213, 177, 103);
    document.roundedRect(132, 43, 64, 9, 1.5, 1.5, 'FD');
    document.setTextColor(111, 76, 17);
  } else {
    document.setFillColor(232, 240, 235);
    document.setDrawColor(168, 191, 178);
    document.roundedRect(158, 43, 38, 9, 1.5, 1.5, 'FD');
    document.setTextColor(43, 91, 66);
  }
  document.text(label, 194, 48.8, { align: 'right' });
}

function drawFirstPageHeader(document: JsPdf, model: QuotePdfModel): number {
  drawBrandHeader(document, model);
  setTextColor(document, BODY_COLOR);
  document.setFont(FONT_NAME, 'bold');
  document.setFontSize(17);
  document.text('Presupuesto', PDF_MARGIN, 49);
  document.setFont(FONT_NAME, 'normal');
  document.setFontSize(8.2);
  setTextColor(document, MUTED_COLOR);
  document.text(`ID ${model.id}`, PDF_MARGIN, 56);
  drawStatus(document, model);

  setTextColor(document, ACCENT_COLOR);
  document.setFont(FONT_NAME, 'bold');
  document.setFontSize(7.5);
  document.text('PROPUESTA', PDF_MARGIN, 66);
  setTextColor(document, BODY_COLOR);
  document.setFontSize(14);
  const titleLines = splitText(document, model.proposalTitle, CONTENT_WIDTH);
  document.text(titleLines, PDF_MARGIN, 73);

  const detailsTop = 75 + titleLines.length * 5.7;
  document.setFontSize(7.4);
  setTextColor(document, MUTED_COLOR);
  document.text('CLIENTE', PDF_MARGIN, detailsTop);
  document.text('OBRA', 108, detailsTop);
  document.setFont(FONT_NAME, 'normal');
  document.setFontSize(8.8);
  setTextColor(document, BODY_COLOR);
  const clientLines = splitText(document, model.clientName, 83);
  const projectLines = splitText(document, model.projectName, 83);
  document.text(clientLines, PDF_MARGIN, detailsTop + 5);
  document.text(projectLines, 108, detailsTop + 5);

  return firstPageTableTop(document, model);
}

function drawContinuationHeader(document: JsPdf, model: QuotePdfModel): void {
  setTextColor(document, BODY_COLOR);
  document.setFont(FONT_NAME, 'bold');
  document.setFontSize(12);
  document.text(model.brand.companyName, PDF_MARGIN, 18);
  document.setFontSize(9);
  document.text(`Presupuesto ${model.id}`, PDF_MARGIN, 27);
  document.setFont(FONT_NAME, 'normal');
  setTextColor(document, MUTED_COLOR);
  document.text(model.status, PDF_PAGE_WIDTH - PDF_MARGIN, 27, { align: 'right' });
  if (model.isDraft) {
    document.setFont(FONT_NAME, 'bold');
    document.setTextColor(111, 76, 17);
    document.text('BORRADOR - NO ES DEFINITIVO', PDF_PAGE_WIDTH - PDF_MARGIN, 18, {
      align: 'right',
    });
  }
  document.setDrawColor(...BORDER_COLOR);
  document.line(PDF_MARGIN, 33, PDF_PAGE_WIDTH - PDF_MARGIN, 33);
}

function drawTableHeader(document: JsPdf, y: number): void {
  const labels = ['Servicio', 'Unidad', 'Cantidad', 'Precio unitario', 'Subtotal'];
  let x = PDF_MARGIN;
  document.setFillColor(...LIGHT_FILL);
  document.setDrawColor(...BORDER_COLOR);
  document.setFont(FONT_NAME, 'bold');
  document.setFontSize(7.5);
  setTextColor(document, BODY_COLOR);

  labels.forEach((label, index) => {
    const width = PDF_COLUMN_WIDTHS[index];
    document.setFillColor(...LIGHT_FILL);
    document.rect(x, y, width, PDF_TABLE_HEADER_HEIGHT, 'FD');
    document.text(label, index >= 2 ? x + width - PDF_ROW_PADDING : x + PDF_ROW_PADDING, y + 5.7, {
      align: index >= 2 ? 'right' : 'left',
    });
    x += width;
  });
}

function drawRows(document: JsPdf, page: QuotePdfPagePlan): void {
  let y = page.tableTop + PDF_TABLE_HEADER_HEIGHT;
  document.setFont(FONT_NAME, 'normal');
  document.setFontSize(8);
  setTextColor(document, BODY_COLOR);

  page.rows.forEach((row, rowIndex) => {
    let x = PDF_MARGIN;
    if (rowIndex % 2 === 1) document.setFillColor(249, 250, 249);

    PDF_COLUMN_WIDTHS.forEach((width, cellIndex) => {
      document.setDrawColor(...BORDER_COLOR);
      if (rowIndex % 2 === 1) document.setFillColor(249, 250, 249);
      document.rect(x, y, width, row.height, rowIndex % 2 === 1 ? 'FD' : 'S');
      const isNumeric = cellIndex >= 2;
      document.text(
        row.cells[cellIndex],
        isNumeric ? x + width - PDF_ROW_PADDING : x + PDF_ROW_PADDING,
        y + PDF_ROW_PADDING + 3,
        { align: isNumeric ? 'right' : 'left' },
      );
      x += width;
    });
    y += row.height;
  });
}

function drawClosingBlock(document: JsPdf, model: QuotePdfModel): void {
  const y = PDF_FOOTER_TOP - PDF_CLOSING_HEIGHT;
  document.setDrawColor(...ACCENT_COLOR);
  document.setLineWidth(0.5);
  document.line(PDF_MARGIN, y, PDF_PAGE_WIDTH - PDF_MARGIN, y);

  setTextColor(document, MUTED_COLOR);
  document.setFont(FONT_NAME, 'bold');
  document.setFontSize(8.5);
  document.text('Inversión total', PDF_MARGIN, y + 10);
  setTextColor(document, BODY_COLOR);
  document.setFontSize(13);
  document.text(formatCurrency(model.total), PDF_PAGE_WIDTH - PDF_MARGIN, y + 10, {
    align: 'right',
  });

  document.setFont(FONT_NAME, 'normal');
  document.setFontSize(8.5);
  const messageLines = splitText(document, ACTION_MESSAGE, 135);
  document.text(messageLines, PDF_MARGIN, y + 21);
  document.setFont(FONT_NAME, 'bold');
  document.text(`WhatsApp ${model.brand.whatsapp.display}`, PDF_PAGE_WIDTH - PDF_MARGIN, y + 21, {
    align: 'right',
  });
}

function footerItems(brand: DeploymentBrandConfig): string[] {
  return [
    brand.footerBusinessText.trim(),
    brand.email.trim(),
    `WhatsApp ${brand.whatsapp.display.trim()}`,
    brand.instagram?.trim(),
  ].filter((item): item is string => Boolean(item));
}

function drawFooter(
  document: JsPdf,
  model: QuotePdfModel,
  pageNumber: number,
  pageCount: number,
): void {
  document.setDrawColor(...BORDER_COLOR);
  document.setLineWidth(0.2);
  document.line(PDF_MARGIN, PDF_FOOTER_TOP, PDF_PAGE_WIDTH - PDF_MARGIN, PDF_FOOTER_TOP);
  document.setFont(FONT_NAME, 'normal');
  document.setFontSize(7.2);
  setTextColor(document, MUTED_COLOR);
  document.text(footerItems(model.brand).join('  |  '), PDF_MARGIN, 285);
  document.text(`Página ${pageNumber} de ${pageCount}`, PDF_PAGE_WIDTH - PDF_MARGIN, 292, {
    align: 'right',
  });
}

async function renderQuote(document: JsPdf, model: QuotePdfModel): Promise<void> {
  await registerFonts(document);
  document.setLineHeightFactor(1.05);
  const tableTop = firstPageTableTop(document, model);
  document.setFont(FONT_NAME, 'normal');
  document.setFontSize(8);
  const formattedRows = model.lines.map((line) => [
    line.description,
    line.unit,
    formatQuantity(line.quantity),
    formatCurrency(line.unitPrice),
    formatCurrency(line.subtotal),
  ]);
  const measuredRows = measureQuotePdfRows(document, model, formattedRows);
  const pages = planQuotePdfPages(measuredRows, tableTop);

  pages.forEach((page, index) => {
    if (index > 0) document.addPage();
    if (page.isFirstPage) drawFirstPageHeader(document, model);
    else drawContinuationHeader(document, model);
    drawTableHeader(document, page.tableTop);
    drawRows(document, page);
    if (page.hasClosingBlock) drawClosingBlock(document, model);
  });

  pages.forEach((_page, index) => {
    document.setPage(index + 1);
    drawFooter(document, model, index + 1, pages.length);
  });
}

export async function createQuotePdfDocument(
  quote: Readonly<Quote>,
  brand: DeploymentBrandConfig = deploymentBrand,
  jsPdfLoader: JsPdfLoader = loadJsPdf,
): Promise<JsPdf> {
  const model = prepareQuotePdfModel(quote, brand);
  const JsPdf = await jsPdfLoader();
  const document = new JsPdf({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await renderQuote(document, model);
  return document;
}

export async function downloadQuotePdf(
  quote: Readonly<Quote>,
  jsPdfLoader: JsPdfLoader = loadJsPdf,
): Promise<void> {
  const model = prepareQuotePdfModel(quote);
  const document = await createQuotePdfDocument(quote, model.brand, jsPdfLoader);
  document.save(model.fileName);
}
