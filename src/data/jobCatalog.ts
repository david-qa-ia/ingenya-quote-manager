import type { CatalogJob } from '../types/quote';

// SCRUM-119: generic starter services. Each workspace edits its own list in
// Configuración > Mis servicios y precios; existing catalogs are never replaced by this seed.
export const initialJobCatalog = [
  {
    id: 'initial-assessment',
    name: 'Relevamiento inicial',
    unit: 'unit',
    defaultPrice: 50000,
    isActive: true,
  },
  {
    id: 'implementation',
    name: 'Implementación',
    unit: 'unit',
    defaultPrice: 300000,
    isActive: true,
  },
  {
    id: 'training',
    name: 'Capacitación del equipo',
    unit: 'unit',
    defaultPrice: 60000,
    isActive: true,
  },
  {
    id: 'monthly-support',
    name: 'Soporte mensual',
    unit: 'unit',
    defaultPrice: 80000,
    isActive: true,
  },
] satisfies CatalogJob[];
