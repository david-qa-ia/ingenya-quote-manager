import type { CatalogJob } from '../types/quote';

export const initialJobCatalog = [
  {
    id: 'build-wall',
    name: 'Levantar pared',
    unit: 'squareMeter',
    defaultPrice: 50000,
    isActive: true,
  },
  {
    id: 'paint-wall',
    name: 'Pintar pared',
    unit: 'squareMeter',
    defaultPrice: 30000,
    isActive: true,
  },
  {
    id: 'install-door',
    name: 'Instalar puerta',
    unit: 'unit',
    defaultPrice: 120000,
    isActive: true,
  },
  {
    id: 'install-baseboard',
    name: 'Colocar zócalos',
    unit: 'linearMeter',
    defaultPrice: 12000,
    isActive: true,
  },
] satisfies CatalogJob[];
