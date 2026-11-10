import type { DeploymentBrandConfig } from '../types/branding';
import type { Quote } from '../types/quote';
import { createQuotePdfDocument } from './quotePdf';

/** Example quote used only to preview the company data and branding from Configuración. */
const sampleQuote: Quote = {
  id: 'PRES-EJEMPLO',
  status: 'finalized',
  commercialStatus: 'prepared',
  commercialStatusAudit: { changedAt: '', changedBy: 'Ejemplo', reason: 'Vista previa' },
  clientName: 'Cliente de ejemplo',
  projectName: 'Presupuesto de ejemplo',
  lines: [
    {
      id: 'sample-1',
      name: 'Servicio de ejemplo',
      description: 'Acá aparece la descripción que cargues para cada servicio.',
      unit: 'squareMeter',
      quantity: 20,
      unitPrice: 5000,
      source: 'manual',
    },
    {
      id: 'sample-2',
      name: 'Otro servicio',
      unit: 'unit',
      quantity: 2,
      unitPrice: 25000,
      source: 'manual',
    },
  ],
};

export async function downloadSampleQuotePdf(brand: DeploymentBrandConfig): Promise<void> {
  const document = await createQuotePdfDocument(sampleQuote, brand, undefined, {
    client: { company: 'Empresa del cliente', phone: '341 555-0000', email: 'cliente@ejemplo.com' },
    opportunity: { address: 'Dirección de la obra' },
  });
  document.save('presupuesto-ejemplo.pdf');
}
