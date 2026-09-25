import type { WorkUnit } from '../types/quote';

export const workUnitLabels: Record<WorkUnit, string> = {
  squareMeter: 'Metro cuadrado',
  linearMeter: 'Metro lineal',
  unit: 'Unidad',
};

export const workUnitSymbols: Record<WorkUnit, string> = {
  squareMeter: 'm²',
  linearMeter: 'ml',
  unit: 'u',
};
