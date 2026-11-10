import {
  fitLogoSize,
  getLogoDataUrlError,
  MAX_LOGO_DATA_URL_LENGTH,
  suggestBrandColor,
} from './companyBranding';

export type LogoUploadResult =
  { ok: true; dataUrl: string; suggestedColor: string | null } | { ok: false; message: string };

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('unreadable'));
    };
    image.src = url;
  });
}

/**
 * Prepares an uploaded logo for the PDF: reduced to the size the PDF needs and stored as PNG
 * (keeps transparency), or as JPEG over white when the PNG would be too heavy.
 */
export async function readLogoFile(file: File): Promise<LogoUploadResult> {
  if (!ACCEPTED_TYPES.includes(file.type))
    return { ok: false, message: 'Elegí una imagen PNG, JPG, WEBP o SVG.' };
  let image: HTMLImageElement;
  try {
    image = await loadImage(file);
  } catch {
    return { ok: false, message: 'No se pudo leer la imagen. Probá con otro archivo.' };
  }
  const natural = { width: image.naturalWidth || 600, height: image.naturalHeight || 240 };
  const size = fitLogoSize(natural.width, natural.height);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) return { ok: false, message: 'No se pudo procesar la imagen en este navegador.' };
  context.drawImage(image, 0, 0, size.width, size.height);
  const suggestedColor = suggestBrandColor(
    context.getImageData(0, 0, size.width, size.height).data,
  );

  let dataUrl = canvas.toDataURL('image/png');
  if (dataUrl.length > MAX_LOGO_DATA_URL_LENGTH) {
    context.globalCompositeOperation = 'destination-over';
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size.width, size.height);
    dataUrl = canvas.toDataURL('image/jpeg', 0.88);
  }
  const error = getLogoDataUrlError(dataUrl);
  return error ? { ok: false, message: error } : { ok: true, dataUrl, suggestedColor };
}
