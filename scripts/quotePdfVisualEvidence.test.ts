import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deploymentBrand } from '../src/config/deploymentBrand';
import type { DeploymentBrandConfig } from '../src/types/branding';
import type { Quote, QuoteLine, QuoteStatus } from '../src/types/quote';
import { createQuotePdfDocument } from '../src/utils/quotePdf';

const shouldGenerateEvidence = process.env.GENERATE_PDF_EVIDENCE === '1';
const evidenceDirectory = resolve('.artifacts/SCRUM-39/pdfs');
const logoDataUrl =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

interface EvidenceScenario {
  readonly fileName: string;
  readonly quote: Quote;
  readonly brand?: DeploymentBrandConfig;
}

function createLines(count: number, overrides: Partial<QuoteLine> = {}): QuoteLine[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `line-${index + 1}`,
    name: `Servicio de construcción ${index + 1}`,
    unit: index % 3 === 0 ? 'squareMeter' : index % 3 === 1 ? 'linearMeter' : 'unit',
    quantity: index % 2 === 0 ? 12.5 : 3,
    unitPrice: 125000 + index * 13750,
    source: 'manual',
    ...overrides,
  }));
}

function createQuote(
  id: string,
  status: QuoteStatus,
  count: number,
  overrides: Partial<Quote> = {},
): Quote {
  return {
    id,
    status,
    clientName: 'María Muñoz',
    projectName: 'Renovación integral de vivienda',
    lines: createLines(count),
    ...overrides,
  };
}

const brandWithLogo: DeploymentBrandConfig = {
  ...deploymentBrand,
  logo: { dataUrl: logoDataUrl, format: 'PNG' },
};
const brandWithInstagram: DeploymentBrandConfig = {
  ...deploymentBrand,
  instagram: '@alef.tau',
};
const brandWithLogoAndInstagram: DeploymentBrandConfig = {
  ...brandWithLogo,
  instagram: '@alef.tau',
};

const scenarios: EvidenceScenario[] = [
  {
    fileName: '01-2-servicios-borrador-sin-logo-sin-instagram.pdf',
    quote: createQuote('PRES-EVIDENCIA-01', 'draft', 2),
  },
  {
    fileName: '02-2-servicios-finalizado-con-logo.pdf',
    quote: createQuote('PRES-EVIDENCIA-02', 'finalized', 2),
    brand: brandWithLogo,
  },
  {
    fileName: '03-8-servicios-finalizado.pdf',
    quote: createQuote('PRES-EVIDENCIA-03', 'finalized', 8),
  },
  {
    fileName: '04-9-servicios-finalizado-con-instagram.pdf',
    quote: createQuote('PRES-EVIDENCIA-04', 'finalized', 9),
    brand: brandWithInstagram,
  },
  {
    fileName: '05-10-servicios-borrador-con-logo.pdf',
    quote: createQuote('PRES-EVIDENCIA-05', 'draft', 10),
    brand: brandWithLogo,
  },
  {
    fileName: '06-11-servicios-finalizado-sin-instagram.pdf',
    quote: createQuote('PRES-EVIDENCIA-06', 'finalized', 11),
  },
  {
    fileName: '07-15-servicios-finalizado-con-logo-instagram.pdf',
    quote: createQuote('PRES-EVIDENCIA-07', 'finalized', 15),
    brand: brandWithLogoAndInstagram,
  },
  {
    fileName: '08-15-servicios-borrador-sin-logo.pdf',
    quote: createQuote('PRES-EVIDENCIA-08', 'draft', 15),
    brand: brandWithInstagram,
  },
  {
    fileName: '09-textos-largos-finalizado.pdf',
    quote: createQuote('PRES-EVIDENCIA-09', 'finalized', 6, {
      clientName: 'Consorcio de Propietarios del Edificio Los Álamos y Administración Fernández',
      projectName:
        'Renovación completa de fachadas, patios internos y sectores comunes de la propiedad',
      lines: createLines(6).map((line, index) => ({
        ...line,
        name:
          index === 2
            ? 'Preparación, reparación y terminación de superficies interiores con fisuras, desniveles y encuentros complejos en muros existentes'
            : `${line.name} con preparación y terminación detallada`,
      })),
    }),
  },
  {
    fileName: '10-importes-grandes-cantidades-decimales.pdf',
    quote: createQuote('PRES-EVIDENCIA-10', 'finalized', 5, {
      lines: createLines(5).map((line, index) => ({
        ...line,
        quantity: 12345.67 + index / 10,
        unitPrice: 987654321 + index * 1234567,
      })),
    }),
  },
  {
    fileName: '11-caracteres-espanoles-finalizado.pdf',
    quote: createQuote('PRES-EVIDENCIA-11', 'finalized', 5, {
      clientName: 'Íñigo Núñez Álvarez',
      projectName: 'Refacción de baño, cañerías y colocación de zócalos',
      lines: createLines(5).map((line, index) => ({
        ...line,
        name: [
          'Reparación de cañería y desagüe',
          'Colocación de zócalos en habitación',
          'Terminación de revoque húmedo',
          'Pintura de cielorraso con preparación',
          'Revisión final de albañilería',
        ][index],
      })),
    }),
  },
];

describe.runIf(shouldGenerateEvidence)('SCRUM-39 visual PDF evidence', () => {
  it('writes every approved real-PDF scenario', async () => {
    mkdirSync(evidenceDirectory, { recursive: true });

    for (const scenario of scenarios) {
      const document = await createQuotePdfDocument(
        scenario.quote,
        scenario.brand ?? deploymentBrand,
      );
      const output = document.output('arraybuffer');
      writeFileSync(resolve(evidenceDirectory, scenario.fileName), Buffer.from(output));
    }

    expect(scenarios).toHaveLength(11);
  });
});
