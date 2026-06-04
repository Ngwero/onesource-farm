const INK_LUM_MAX = 95;
const MIN_INK_ALPHA = 48;

function pixelAt(width: number, x: number, y: number): number {
  return (y * width + x) * 4;
}

/** Expand ink strokes outward so thin signatures read bolder on screen and in PDFs. */
function thickenSignatureInk(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  radius = 1
): void {
  const mask = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = pixelAt(width, x, y);
      if (data[i + 3]! < MIN_INK_ALPHA) continue;
      const lum = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
      if (lum <= INK_LUM_MAX) mask[y * width + x] = 1;
    }
  }

  const out = new Uint8ClampedArray(data);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) > radius) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const i = pixelAt(width, nx, ny);
          if (out[i + 3]! >= MIN_INK_ALPHA) {
            const lum = 0.299 * out[i]! + 0.587 * out[i + 1]! + 0.114 * out[i + 2]!;
            if (lum <= INK_LUM_MAX) continue;
          }
          out[i] = 8;
          out[i + 1] = 8;
          out[i + 2] = 8;
          out[i + 3] = 255;
        }
      }
    }
  }

  data.set(out);
}

/** Shared pixel-level signature enhancement (browser + Node). */
export function enhanceSignaturePixels(
  data: Uint8ClampedArray,
  width: number,
  height: number
): void {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    let a = data[i + 3]!;

    if (a < 16) continue;

    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    if (lum > 242) {
      data[i + 3] = 0;
      continue;
    }

    const strength =
      lum > 220 ? 0.96 : lum > 190 ? 0.9 : lum > 160 ? 0.78 : lum > 120 ? 0.62 : 0.45;

    const ink = (v: number) =>
      Math.round(Math.max(0, Math.min(18, v * (1 - strength))));

    data[i] = ink(r);
    data[i + 1] = ink(g);
    data[i + 2] = ink(b);
    a = Math.min(255, Math.max(a, 230));
    data[i + 3] = a;
  }

  // Second pass — lift any remaining mid-gray ink to near-black
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! < 32) continue;
    const lum = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
    if (lum > 90) {
      const t = Math.min(1, (lum - 90) / 120);
      data[i] = Math.round(data[i]! * (1 - t) + 12 * t);
      data[i + 1] = Math.round(data[i + 1]! * (1 - t) + 12 * t);
      data[i + 2] = Math.round(data[i + 2]! * (1 - t) + 12 * t);
    }
  }

  thickenSignatureInk(data, width, height, 1);
}
