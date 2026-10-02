export const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export const quantityFormatter = new Intl.NumberFormat('es-AR', {
  maximumFractionDigits: 2,
});

export function formatQuantity(value: number): string {
  return quantityFormatter.format(value);
}
