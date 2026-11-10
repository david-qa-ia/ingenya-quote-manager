import { describe, expect, it } from 'vitest';
import {
  contrastWithWhite,
  fitLogoSize,
  getBrandColorError,
  getLogoDataUrlError,
  MAX_LOGO_DATA_URL_LENGTH,
  suggestBrandColor,
} from './companyBranding';

const pixels = (...colors: [number, number, number, number][]) => colors.flat();

describe('company branding of the quote PDF', () => {
  it('accepts PNG and JPEG logos up to the size limit and nothing else', () => {
    expect(getLogoDataUrlError('')).toBeNull();
    expect(getLogoDataUrlError('data:image/png;base64,iVBORw0KGgo=')).toBeNull();
    expect(getLogoDataUrlError('data:image/jpeg;base64,/9j/4AAQ')).toBeNull();
    expect(getLogoDataUrlError('data:image/svg+xml;base64,PHN2Zz4=')).toBe(
      'El logo tiene que ser una imagen PNG o JPG.',
    );
    expect(getLogoDataUrlError('https://example.com/logo.png')).not.toBeNull();
    const heavy = `data:image/png;base64,${'A'.repeat(MAX_LOGO_DATA_URL_LENGTH)}`;
    expect(getLogoDataUrlError(heavy)).toBe(
      'El logo es demasiado pesado. Probá con una imagen más simple o más chica.',
    );
  });

  it('reduces a large logo to the print box without enlarging a small one', () => {
    expect(fitLogoSize(3000, 1000)).toEqual({ width: 720, height: 240 });
    expect(fitLogoSize(1000, 1000)).toEqual({ width: 280, height: 280 });
    expect(fitLogoSize(200, 80)).toEqual({ width: 200, height: 80 });
  });

  it('only accepts brand colors where the white total stays readable', () => {
    expect(getBrandColorError('')).toBeNull();
    expect(getBrandColorError('#2F6BFF')).toBeNull();
    expect(getBrandColorError('blue')).toBe('Ingresá un color como #2F6BFF.');
    expect(getBrandColorError('#FFE066')).toBe(
      'Elegí un color más oscuro: el total del PDF va escrito en blanco sobre este color.',
    );
  });

  it('suggests the main color of the logo, darkened when white text would not read on it', () => {
    const greenLogo = pixels(
      [255, 255, 255, 255],
      [255, 255, 255, 255],
      [0, 0, 0, 0],
      [14, 124, 102, 255],
      [14, 124, 102, 255],
      [20, 30, 40, 255],
    );
    expect(suggestBrandColor(greenLogo)).toBe('#0E7C66');

    const yellow = suggestBrandColor(pixels([255, 214, 0, 255]))!;
    expect(contrastWithWhite(yellow)).toBeGreaterThanOrEqual(3);
    expect(getBrandColorError(yellow)).toBeNull();

    expect(suggestBrandColor(pixels([0, 0, 0, 255], [255, 255, 255, 255]))).toBeNull();
  });
});
