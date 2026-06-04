import sharp from 'sharp';
import { enhanceSignaturePixels } from './pixels';

/** Darken pale / low-contrast signature ink and knock out near-white backgrounds. */
export async function enhanceSignatureBuffer(buffer: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const pixels = new Uint8ClampedArray(data.length);
  pixels.set(data);
  enhanceSignaturePixels(pixels, info.width, info.height);

  return sharp(Buffer.from(pixels), {
    raw: { width: info.width, height: info.height, channels: info.channels as 3 | 4 },
  })
    .png()
    .toBuffer();
}

export async function loadEnhancedSignature(relativePath: string): Promise<Buffer | null> {
  try {
    const { readFile } = await import('@/lib/storage');
    const raw = await readFile(relativePath);
    return enhanceSignatureBuffer(raw);
  } catch {
    return null;
  }
}
