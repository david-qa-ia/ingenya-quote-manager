/**
 * Branding of a workspace's quote PDF: the logo and the brand color. Each company that uses the
 * app (SaaS) sets its own in Configuración > Datos de la empresa.
 */

/** A stored logo is a PNG or JPEG data URL; ~220 KB of image at most. */
export const MAX_LOGO_DATA_URL_LENGTH = 300_000;
/** Pixel box the uploaded logo is reduced to: sharp in print at the size the PDF uses. */
export const LOGO_MAX_PIXEL_WIDTH = 720;
export const LOGO_MAX_PIXEL_HEIGHT = 280;
/** White text over the brand color (the PDF total) must stay readable: WCAG large text, 3:1. */
const MIN_CONTRAST_WITH_WHITE = 3;

const LOGO_PATTERN = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;
const COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export function getLogoDataUrlError(dataUrl: string): string | null {
  if (!dataUrl) return null;
  if (!LOGO_PATTERN.test(dataUrl)) return 'El logo tiene que ser una imagen PNG o JPG.';
  if (dataUrl.length > MAX_LOGO_DATA_URL_LENGTH)
    return 'El logo es demasiado pesado. Probá con una imagen más simple o más chica.';
  return null;
}

export const logoFormat = (dataUrl: string): 'PNG' | 'JPEG' =>
  dataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';

/** Size to draw an image so it fits the box without being enlarged. */
export function fitLogoSize(
  width: number,
  height: number,
  maxWidth = LOGO_MAX_PIXEL_WIDTH,
  maxHeight = LOGO_MAX_PIXEL_HEIGHT,
): { width: number; height: number } {
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)) as [
    number,
    number,
    number,
  ];
}

const toHex = (rgb: readonly number[]) =>
  `#${rgb.map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`.toUpperCase();

function luminance(rgb: readonly number[]): number {
  const [r, g, b] = rgb.map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export const contrastWithWhite = (hex: string) => 1.05 / (luminance(channels(hex)) + 0.05);

export function getBrandColorError(color: string): string | null {
  if (!color) return null;
  if (!COLOR_PATTERN.test(color)) return 'Ingresá un color como #2F6BFF.';
  if (contrastWithWhite(color) < MIN_CONTRAST_WITH_WHITE)
    return 'Elegí un color más oscuro: el total del PDF va escrito en blanco sobre este color.';
  return null;
}

/** Darkens a color just enough for white text on it to be readable. */
export function readableBrandColor(hex: string): string {
  let rgb = channels(hex);
  while (contrastWithWhite(toHex(rgb)) < MIN_CONTRAST_WITH_WHITE)
    rgb = rgb.map((value) => value * 0.92) as [number, number, number];
  return toHex(rgb);
}

/**
 * Suggests the brand color from the logo pixels (RGBA): the most common clearly colored tone,
 * ignoring transparent, white, black and gray areas, darkened if white text would not read on it.
 * Returns null for a logo without color (black on white, for example).
 */
export function suggestBrandColor(pixels: ArrayLike<number>): string | null {
  const buckets = new Map<string, { count: number; sum: [number, number, number] }>();
  for (let index = 0; index + 3 < pixels.length; index += 4) {
    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];
    if (pixels[index + 3] < 200) continue;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max < 40 || max - min < 50) continue;
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const bucket = buckets.get(key) ?? { count: 0, sum: [0, 0, 0] };
    bucket.count += 1;
    bucket.sum = [bucket.sum[0] + r, bucket.sum[1] + g, bucket.sum[2] + b];
    buckets.set(key, bucket);
  }
  let best: { count: number; sum: [number, number, number] } | undefined;
  for (const bucket of buckets.values()) if (!best || bucket.count > best.count) best = bucket;
  if (!best) return null;
  return readableBrandColor(toHex(best.sum.map((value) => value / best.count)));
}
