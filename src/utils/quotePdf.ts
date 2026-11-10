import type { jsPDF as JsPdf } from 'jspdf';
import type { DeploymentBrandConfig } from '../types/branding';
import type { Quote } from '../types/quote';
import { loadClients } from './clientStorage';
import { loadCompanyBrand } from './companyProfileStorage';
import { loadOpportunities } from './opportunityStorage';
import { formatCurrency, formatQuantity } from './quoteFormatting';
import {
  PDF_COLUMN_WIDTHS,
  PDF_CONTENT_WIDTH,
  PDF_FOOTER_TOP,
  PDF_MARGIN,
  PDF_PAGE_WIDTH,
  PDF_ROW_PADDING,
  PDF_TABLE_HEADER_HEIGHT,
  planQuotePdfPages,
  type QuotePdfBlock,
  type QuotePdfMeasuredRow,
  type QuotePdfPagePlan,
} from './quotePdfLayout';
import { prepareQuotePdfModel, type QuotePdfContext, type QuotePdfModel } from './quotePdfModel';

type JsPdfConstructor = (typeof import('jspdf'))['jsPDF'];
type JsPdfLoader = () => Promise<JsPdfConstructor>;
type Rgb = readonly [number, number, number];

const FONT_NAME = 'Lato';
const RIGHT = PDF_PAGE_WIDTH - PDF_MARGIN;
const INK: Rgb = [17, 18, 22];
const MUTED: Rgb = [92, 95, 102];
const BORDER: Rgb = [227, 227, 224];
const WHITE: Rgb = [255, 255, 255];
const DRAFT_FILL: Rgb = [250, 241, 222];
const DRAFT_TEXT: Rgb = [111, 76, 17];
/** Ventro blue, used when the workspace has no brand color of its own. */
const DEFAULT_ACCENT: Rgb = [47, 107, 255];

/** Turns the workspace brand color (#RRGGBB) into RGB; anything else keeps Ventro blue. */
function brandAccent(color: string | undefined): Rgb {
  const match = /^#([0-9a-f]{6})$/i.exec(color?.trim() ?? '');
  if (!match) return DEFAULT_ACCENT;
  return [0, 2, 4].map((offset) =>
    parseInt(match[1].slice(offset, offset + 2), 16),
  ) as unknown as Rgb;
}

const LOGO_MAX_WIDTH = 52;
const LOGO_MAX_HEIGHT = 20;
const HEADER_TOP = 14;
const COLUMN_GAP = 6;
const NAME_LINE = 4;
const DETAIL_LINE = 3.5;
const BODY_LINE = 3.9;
const TOTAL_WIDTH = 84;
const TOTAL_HEIGHT = 13;
const SIGNATURE_AREA = 22;

interface Painter {
  readonly doc: JsPdf;
  readonly model: QuotePdfModel;
  readonly accent: Rgb;
  readonly accentTint: Rgb;
}

async function loadJsPdf(): Promise<JsPdfConstructor> {
  return (await import('jspdf')).jsPDF;
}

function fontBase64(dataUrl: string): string {
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
}

async function registerFonts(doc: JsPdf): Promise<void> {
  const [{ default: regularFontDataUrl }, { default: boldFontDataUrl }] = await Promise.all([
    import('../assets/fonts/Lato-Regular.ttf?inline'),
    import('../assets/fonts/Lato-Bold.ttf?inline'),
  ]);
  doc.addFileToVFS('Lato-Regular.ttf', fontBase64(regularFontDataUrl));
  doc.addFileToVFS('Lato-Bold.ttf', fontBase64(boldFontDataUrl));
  doc.addFont('Lato-Regular.ttf', FONT_NAME, 'normal');
  doc.addFont('Lato-Bold.ttf', FONT_NAME, 'bold');
  doc.setFont(FONT_NAME, 'normal');
}

function font(doc: JsPdf, weight: 'normal' | 'bold', size: number, color: Rgb): void {
  doc.setFont(FONT_NAME, weight);
  doc.setFontSize(size);
  doc.setTextColor(color[0], color[1], color[2]);
}

function split(doc: JsPdf, text: string, width: number): string[] {
  return text ? (doc.splitTextToSize(text, width) as string[]) : [];
}

const tint = (color: Rgb, amount: number): Rgb =>
  color.map((channel) => Math.round(channel + (255 - channel) * amount)) as unknown as Rgb;

const whatsappLabel = (brand: DeploymentBrandConfig) =>
  brand.whatsapp.display.trim() ? `WhatsApp ${brand.whatsapp.display.trim()}` : '';

function logoSize(
  doc: JsPdf,
  brand: DeploymentBrandConfig,
  maxWidth = LOGO_MAX_WIDTH,
  maxHeight = LOGO_MAX_HEIGHT,
) {
  if (!brand.logo) return null;
  const properties = doc.getImageProperties(brand.logo.dataUrl);
  const scale = Math.min(maxWidth / properties.width, maxHeight / properties.height);
  return { width: properties.width * scale, height: properties.height * scale };
}

/** Brand on the left (logo, or the company name when there is none); quote data on the right. */
function drawBrandHeader(p: Painter, draw: boolean): number {
  const { doc, model } = p;
  let bottom: number;
  const logo = logoSize(doc, model.brand);
  if (logo && model.brand.logo) {
    if (draw)
      doc.addImage(
        model.brand.logo.dataUrl,
        model.brand.logo.format,
        PDF_MARGIN,
        HEADER_TOP,
        logo.width,
        logo.height,
      );
    bottom = HEADER_TOP + logo.height;
  } else {
    font(doc, 'bold', 17, INK);
    const nameLines = split(doc, model.brand.companyName, 104);
    if (draw) doc.text(nameLines, PDF_MARGIN, HEADER_TOP + 6);
    bottom = HEADER_TOP + 6 + (nameLines.length - 1) * 6.6;
    const tagline = model.brand.experienceMessage?.trim();
    if (tagline) {
      font(doc, 'normal', 8.4, MUTED);
      if (draw) doc.text(split(doc, tagline, 104)[0], PDF_MARGIN, bottom + 5);
      bottom += 5;
    }
  }

  if (draw) {
    font(doc, 'bold', 8, p.accent);
    doc.text('PRESUPUESTO', RIGHT, HEADER_TOP + 3, { align: 'right' });
    font(doc, 'bold', 10.5, INK);
    doc.text(model.id, RIGHT, HEADER_TOP + 9, { align: 'right' });
    font(doc, 'normal', 8.2, MUTED);
    doc.text(`Emitido el ${model.issuedOn}`, RIGHT, HEADER_TOP + 14.5, { align: 'right' });
    doc.text(`Válido hasta el ${model.validUntil}`, RIGHT, HEADER_TOP + 19, { align: 'right' });
  }
  return Math.max(bottom, HEADER_TOP + 20);
}

function drawDraftNotice(p: Painter, top: number, draw: boolean): number {
  if (!p.model.isDraft) return top;
  if (draw) {
    p.doc.setFillColor(...DRAFT_FILL);
    p.doc.roundedRect(PDF_MARGIN, top, PDF_CONTENT_WIDTH, 8, 1.2, 1.2, 'F');
    font(p.doc, 'bold', 8, DRAFT_TEXT);
    p.doc.text(
      'BORRADOR · No es definitivo: los servicios y los importes pueden cambiar.',
      PDF_MARGIN + 4,
      top + 5.3,
    );
  }
  return top + 8 + 4;
}

interface PartyColumn {
  readonly label: string;
  readonly primary: string;
  readonly secondary: readonly string[];
}

function partyColumns(model: QuotePdfModel): PartyColumn[] {
  const { brand, recipient } = model;
  const columns: PartyColumn[] = [
    {
      label: 'PARA',
      primary: recipient.name,
      secondary: [recipient.company, recipient.phone, recipient.email].filter(Boolean),
    },
  ];
  if (model.siteAddress)
    columns.push({ label: 'LUGAR DE LA OBRA', primary: model.siteAddress, secondary: [] });
  columns.push({
    label: 'DE',
    primary: brand.companyName,
    secondary: [brand.email.trim(), whatsappLabel(brand), brand.website?.trim() ?? ''].filter(
      Boolean,
    ),
  });
  return columns;
}

function drawParties(p: Painter, top: number, draw: boolean): number {
  const { doc } = p;
  const columns = partyColumns(p.model);
  const width = (PDF_CONTENT_WIDTH - COLUMN_GAP * 2) / 3;
  let bottom = top;
  columns.forEach((column, index) => {
    const x = PDF_MARGIN + index * (width + COLUMN_GAP);
    font(doc, 'bold', 7, MUTED);
    if (draw) doc.text(column.label, x, top, { charSpace: 0.4 });
    let y = top + 5;
    font(doc, 'bold', 9.2, INK);
    const primary = split(doc, column.primary, width);
    if (draw) doc.text(primary, x, y);
    y += (primary.length - 1) * NAME_LINE + BODY_LINE + 0.4;
    font(doc, 'normal', 8.2, MUTED);
    for (const item of column.secondary) {
      const lines = split(doc, item, width);
      if (draw) doc.text(lines, x, y);
      y += lines.length * BODY_LINE;
    }
    bottom = Math.max(bottom, y - BODY_LINE);
  });
  return bottom;
}

/** Draws (or only measures) the first page header and returns where the table starts. */
function drawFirstPageHeader(p: Painter, draw: boolean): number {
  const { doc, model } = p;
  let y = drawBrandHeader(p, draw) + 5;
  if (draw) {
    doc.setDrawColor(...p.accent);
    doc.setLineWidth(0.6);
    doc.line(PDF_MARGIN, y, RIGHT, y);
  }
  y = drawDraftNotice(p, y + 4, draw);
  if (!model.isDraft) y += 2;

  font(doc, 'bold', 15, INK);
  const titleLines = split(doc, model.title, PDF_CONTENT_WIDTH);
  y += 5;
  if (draw) doc.text(titleLines, PDF_MARGIN, y);
  y += (titleLines.length - 1) * 6.2 + 9;

  return drawParties(p, y, draw) + 9;
}

function drawContinuationHeader(p: Painter): void {
  const { doc, model } = p;
  const logo = logoSize(doc, model.brand, 34, 9);
  if (logo && model.brand.logo) {
    doc.addImage(
      model.brand.logo.dataUrl,
      model.brand.logo.format,
      PDF_MARGIN,
      20 - logo.height,
      logo.width,
      logo.height,
    );
  } else {
    font(doc, 'bold', 10.5, INK);
    doc.text(split(doc, model.brand.companyName, 100)[0], PDF_MARGIN, 18);
  }
  font(doc, 'normal', 8.4, MUTED);
  doc.text(`Presupuesto ${model.id}`, RIGHT, 18, { align: 'right' });
  if (model.isDraft) {
    font(doc, 'bold', 7.6, DRAFT_TEXT);
    doc.text('BORRADOR · NO ES DEFINITIVO', RIGHT, 22.5, { align: 'right' });
  }
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(PDF_MARGIN, 25.5, RIGHT, 25.5);
}

interface RowCells {
  readonly name: string[];
  readonly details: string[];
  readonly quantity: string;
  readonly unitPrice: string;
  readonly subtotal: string;
}

function measureRows(p: Painter): { cells: RowCells[]; rows: QuotePdfMeasuredRow[] } {
  const { doc, model } = p;
  const textWidth = PDF_COLUMN_WIDTHS[0] - PDF_ROW_PADDING * 2;
  const cells = model.lines.map((line) => {
    font(doc, 'bold', 8.8, INK);
    const name = split(doc, line.name, textWidth);
    font(doc, 'normal', 7.8, MUTED);
    const details = split(doc, line.details, textWidth);
    return {
      name,
      details,
      quantity: `${formatQuantity(line.quantity)} ${line.unit}`,
      unitPrice: formatCurrency(line.unitPrice),
      subtotal: formatCurrency(line.subtotal),
    };
  });
  const rows = cells.map((cell, index) => ({
    index,
    height: Math.max(
      10,
      PDF_ROW_PADDING * 2 +
        2.6 +
        (cell.name.length - 1) * NAME_LINE +
        (cell.details.length ? 1.4 + cell.details.length * DETAIL_LINE : 0),
    ),
  }));
  return { cells, rows };
}

function drawTableHeader(p: Painter, y: number): void {
  const { doc } = p;
  const labels = ['Servicio', 'Cantidad', 'Precio unitario', 'Importe'];
  doc.setFillColor(...p.accentTint);
  doc.rect(PDF_MARGIN, y, PDF_CONTENT_WIDTH, PDF_TABLE_HEADER_HEIGHT, 'F');
  font(doc, 'bold', 7.6, INK);
  let x = PDF_MARGIN;
  labels.forEach((label, index) => {
    const width = PDF_COLUMN_WIDTHS[index];
    const numeric = index > 0;
    doc.text(label, numeric ? x + width - PDF_ROW_PADDING : x + PDF_ROW_PADDING, y + 5.3, {
      align: numeric ? 'right' : 'left',
    });
    x += width;
  });
}

function drawRows(p: Painter, page: QuotePdfPagePlan, cells: readonly RowCells[]): void {
  const { doc } = p;
  let y = page.tableTop + PDF_TABLE_HEADER_HEIGHT;
  for (const row of page.rows) {
    const cell = cells[row.index];
    const baseline = y + PDF_ROW_PADDING + 2.6;
    font(doc, 'bold', 8.8, INK);
    doc.text(cell.name, PDF_MARGIN + PDF_ROW_PADDING, baseline);
    if (cell.details.length) {
      font(doc, 'normal', 7.8, MUTED);
      doc.text(
        cell.details,
        PDF_MARGIN + PDF_ROW_PADDING,
        baseline + (cell.name.length - 1) * NAME_LINE + 1.4 + DETAIL_LINE,
      );
    }
    font(doc, 'normal', 8.6, INK);
    let x = PDF_MARGIN + PDF_COLUMN_WIDTHS[0];
    [cell.quantity, cell.unitPrice, cell.subtotal].forEach((value, index) => {
      const width = PDF_COLUMN_WIDTHS[index + 1];
      if (index === 2) font(doc, 'bold', 8.8, INK);
      doc.text(value, x + width - PDF_ROW_PADDING, baseline, { align: 'right' });
      x += width;
    });
    y += row.height;
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.25);
    doc.line(PDF_MARGIN, y, RIGHT, y);
  }
}

const DISCOUNT_ROW = 6;

/** With a discount, subtotal and discount rows go above the total box. */
const totalBlockHeight = (model: QuotePdfModel) =>
  (model.discountAmount > 0 ? DISCOUNT_ROW * 2 + 2 : 0) + TOTAL_HEIGHT;

function drawTotal(p: Painter, blockTop: number): void {
  const { doc, model } = p;
  const x = RIGHT - TOTAL_WIDTH;
  let top = blockTop;
  if (model.discountAmount > 0) {
    const rows: [string, string][] = [
      ['Subtotal', formatCurrency(model.subtotal)],
      [model.discountLabel, `−${formatCurrency(model.discountAmount)}`],
    ];
    rows.forEach(([label, value], index) => {
      const baseline = top + 4.2 + index * DISCOUNT_ROW;
      font(doc, 'normal', 8.8, MUTED);
      doc.text(label, x + 5, baseline);
      font(doc, index === 1 ? 'bold' : 'normal', 8.8, index === 1 ? p.accent : INK);
      doc.text(value, RIGHT - 5, baseline, { align: 'right' });
    });
    top += DISCOUNT_ROW * 2 + 2;
  }
  doc.setFillColor(...p.accent);
  doc.roundedRect(x, top, TOTAL_WIDTH, TOTAL_HEIGHT, 1.5, 1.5, 'F');
  font(doc, 'bold', 9, WHITE);
  doc.text('Total', x + 5, top + 8.2);
  font(doc, 'bold', 13, WHITE);
  doc.text(formatCurrency(model.total), RIGHT - 5, top + 8.6, { align: 'right' });
}

const CONDITION_LABEL_WIDTH = 38;

function conditionLines(p: Painter): string[][] {
  font(p.doc, 'normal', 8.4, INK);
  return p.model.conditions.map((condition) =>
    split(p.doc, condition.text, PDF_CONTENT_WIDTH - CONDITION_LABEL_WIDTH),
  );
}

function conditionsHeight(p: Painter): number {
  return 7 + conditionLines(p).reduce((total, lines) => total + lines.length * BODY_LINE + 2.4, 0);
}

function drawConditions(p: Painter, top: number): void {
  const { doc, model } = p;
  font(doc, 'bold', 10, INK);
  doc.text('Condiciones', PDF_MARGIN, top + 3.5);
  let y = top + 9.5;
  const lines = conditionLines(p);
  model.conditions.forEach((condition, index) => {
    font(doc, 'bold', 8.2, MUTED);
    doc.text(condition.label, PDF_MARGIN, y);
    font(doc, 'normal', 8.4, INK);
    doc.text(lines[index], PDF_MARGIN + CONDITION_LABEL_WIDTH, y);
    y += lines[index].length * BODY_LINE + 2.4;
  });
}

function acceptanceLines(p: Painter): string[] {
  font(p.doc, 'normal', 8.4, INK);
  return split(p.doc, p.model.acceptanceText, PDF_CONTENT_WIDTH - 10);
}

const acceptanceHeight = (p: Painter) =>
  10 + acceptanceLines(p).length * BODY_LINE + SIGNATURE_AREA;

function drawAcceptance(p: Painter, top: number): void {
  const { doc } = p;
  const height = acceptanceHeight(p);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(PDF_MARGIN, top, PDF_CONTENT_WIDTH, height, 1.8, 1.8, 'S');
  font(doc, 'bold', 10, INK);
  doc.text('Aceptación del presupuesto', PDF_MARGIN + 5, top + 7.5);
  const lines = acceptanceLines(p);
  doc.text(lines, PDF_MARGIN + 5, top + 13);
  const lineY = top + height - 9;
  const fieldWidth = (PDF_CONTENT_WIDTH - 10 - 16) / 3;
  ['Firma', 'Aclaración', 'Fecha'].forEach((label, index) => {
    const x = PDF_MARGIN + 5 + index * (fieldWidth + 8);
    doc.setDrawColor(...MUTED);
    doc.setLineWidth(0.25);
    doc.line(x, lineY, x + fieldWidth, lineY);
    font(doc, 'normal', 7.6, MUTED);
    doc.text(label, x, lineY + 4);
  });
}

function footerItems(brand: DeploymentBrandConfig): string[] {
  return [
    brand.footerBusinessText.trim(),
    brand.email.trim(),
    whatsappLabel(brand),
    brand.website?.trim(),
    brand.instagram?.trim(),
  ].filter((item): item is string => Boolean(item));
}

function drawFooter(p: Painter, pageNumber: number, pageCount: number): void {
  const { doc, model } = p;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.25);
  doc.line(PDF_MARGIN, PDF_FOOTER_TOP, RIGHT, PDF_FOOTER_TOP);
  font(doc, 'normal', 7.2, MUTED);
  const pageLabel = `Página ${pageNumber} de ${pageCount}`;
  const items = split(doc, footerItems(model.brand).join('  ·  '), PDF_CONTENT_WIDTH - 30);
  if (items.length) doc.text(items[0], PDF_MARGIN, PDF_FOOTER_TOP + 5.5);
  doc.text(pageLabel, RIGHT, PDF_FOOTER_TOP + 5.5, { align: 'right' });
}

async function renderQuote(doc: JsPdf, model: QuotePdfModel): Promise<void> {
  await registerFonts(doc);
  doc.setLineHeightFactor(1.15);
  const accent = brandAccent(model.brand.accentColor);
  const painter: Painter = { doc, model, accent, accentTint: tint(accent, 0.9) };

  const tableTop = drawFirstPageHeader(painter, false);
  const { cells, rows } = measureRows(painter);
  const blocks: QuotePdfBlock[] = [
    { key: 'total', height: totalBlockHeight(model) },
    { key: 'conditions', height: conditionsHeight(painter) },
    { key: 'acceptance', height: acceptanceHeight(painter) },
  ];
  const pages = planQuotePdfPages(rows, tableTop, blocks);
  const drawBlock: Record<string, (top: number) => void> = {
    total: (top) => drawTotal(painter, top),
    conditions: (top) => drawConditions(painter, top),
    acceptance: (top) => drawAcceptance(painter, top),
  };

  pages.forEach((page, index) => {
    if (index > 0) doc.addPage();
    if (page.isFirstPage) drawFirstPageHeader(painter, true);
    else drawContinuationHeader(painter);
    if (page.rows.length) {
      drawTableHeader(painter, page.tableTop);
      drawRows(painter, page, cells);
    }
    page.blocks.forEach((block) => drawBlock[block.key](block.top));
  });

  pages.forEach((_page, index) => {
    doc.setPage(index + 1);
    drawFooter(painter, index + 1, pages.length);
  });
}

/** The client and opportunity of the quote as they are stored now (contact data, job address). */
export function resolveQuotePdfContext(quote: Readonly<Quote>): QuotePdfContext {
  const client = quote.clientId
    ? loadClients().items.find((item) => item.id === quote.clientId)
    : undefined;
  const opportunity = quote.opportunityId
    ? loadOpportunities().items.find((item) => item.id === quote.opportunityId)
    : undefined;
  return { client, opportunity };
}

export async function createQuotePdfDocument(
  quote: Readonly<Quote>,
  brand: DeploymentBrandConfig = loadCompanyBrand(),
  jsPdfLoader: JsPdfLoader = loadJsPdf,
  context: QuotePdfContext = resolveQuotePdfContext(quote),
): Promise<JsPdf> {
  const model = prepareQuotePdfModel(quote, brand, new Date(), context);
  const JsPdfClass = await jsPdfLoader();
  const doc = new JsPdfClass({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await renderQuote(doc, model);
  return doc;
}

export async function downloadQuotePdf(
  quote: Readonly<Quote>,
  jsPdfLoader: JsPdfLoader = loadJsPdf,
): Promise<void> {
  const model = prepareQuotePdfModel(quote);
  const doc = await createQuotePdfDocument(quote, model.brand, jsPdfLoader);
  doc.save(model.fileName);
}
