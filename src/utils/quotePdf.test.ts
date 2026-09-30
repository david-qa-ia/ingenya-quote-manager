import { describe, expect, it, vi } from 'vitest';
import type { jsPDF as JsPdf } from 'jspdf';
import type { QuoteDraft } from '../types/quote';
import { downloadQuotePdf } from './quotePdf';

const draft: QuoteDraft = {
  id: 'PRES-2026-0001',
  status: 'draft',
  clientName: '',
  projectName: '',
  lines: [
    {
      id: 'line-1',
      name: 'Pintar pared',
      unit: 'squareMeter',
      quantity: 2,
      unitPrice: 1000,
      source: 'manual',
    },
  ],
};

function createDocumentMock() {
  return {
    internal: { pageSize: { getHeight: () => 297 } },
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    text: vi.fn(),
    setDrawColor: vi.fn(),
    line: vi.fn(),
    setFillColor: vi.fn(),
    rect: vi.fn(),
    splitTextToSize: vi.fn((text: string) => [text]),
    addPage: vi.fn(),
    getNumberOfPages: vi.fn(() => 1),
    setPage: vi.fn(),
    setTextColor: vi.fn(),
    save: vi.fn(),
  };
}

describe('downloadQuotePdf', () => {
  it('downloads the prepared quote using its safe file name', async () => {
    const document = createDocumentMock();
    const constructorSpy = vi.fn();
    class JsPdfMock {
      constructor(options: unknown) {
        constructorSpy(options);
        return document;
      }
    }

    await downloadQuotePdf(draft, async () => JsPdfMock as unknown as typeof JsPdf);

    expect(constructorSpy).toHaveBeenCalledWith({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    expect(document.save).toHaveBeenCalledWith('presupuesto-PRES-2026-0001.pdf');
  });

  it('propagates a loading failure so the interface can report it and retry', async () => {
    await expect(
      downloadQuotePdf(draft, async () => {
        throw new Error('No se pudo cargar jsPDF');
      }),
    ).rejects.toThrow('No se pudo cargar jsPDF');
  });
});
