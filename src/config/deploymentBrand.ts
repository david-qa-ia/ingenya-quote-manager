import type { DeploymentBrandConfig } from '../types/branding';

/** Name of the application itself, shown in the navigation (always Ventro). */
export const APP_NAME = 'ventro';

/**
 * SCRUM-119: fallback company data for the quote PDF. Each workspace overrides it from
 * Configuración > Datos de la empresa (stored in Supabase), so another company using the app
 * prints its own data. These are Ventro's own details.
 */
export const deploymentBrand: DeploymentBrandConfig = {
  companyName: 'Ventro',
  email: 'david@somosventro.com',
  whatsapp: {
    display: '341 779-3657',
    value: '3417793657',
  },
  website: 'www.somosventro.com',
  footerBusinessText: 'Ventro',
  quoteValidityDays: 15,
};
