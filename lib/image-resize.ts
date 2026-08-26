/**
 * Client-side image downsizing before upload — re-encodes as JPEG, scaled to
 * fit within MAX_DIMENSION, with quality stepped down until the result fits
 * MAX_BYTES (or the smallest attempt made, if it never quite gets there).
 * Anything not worth downsizing (already small, not an image, or a format the
 * browser can't decode into a canvas — e.g. HEIC in most browsers) passes
 * through untouched rather than failing the upload.
 */

const MAX_BYTES = 1024 * 1024;
const MAX_DIMENSION = 1920;
const QUALITY_STEPS = [0.82, 0.7, 0.55, 0.4];

export async function fileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/') || file.size <= MAX_BYTES) {
    return readAsDataUrl(file);
  }

  try {
    return await downsizeImage(file);
  } catch {
    return readAsDataUrl(file);
  }
}

function readAsDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

async function downsizeImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  // White backdrop first — a transparent PNG re-encoded as JPEG would
  // otherwise turn its transparent areas black.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);

  let smallest: Blob | null = null;
  for (const quality of QUALITY_STEPS) {
    const blob = await canvasToBlob(canvas, quality);
    if (!blob) continue;
    if (!smallest || blob.size < smallest.size) smallest = blob;
    if (blob.size <= MAX_BYTES) return readAsDataUrl(blob);
  }

  // Never quite got under the target — the smallest attempt still beats the original.
  return smallest ? readAsDataUrl(smallest) : readAsDataUrl(file);
}
