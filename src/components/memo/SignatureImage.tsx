'use client';

import { useEffect, useState } from 'react';
import { enhanceSignaturePixels } from '@/lib/signature/pixels';

interface SignatureImageProps {
  src: string;
  alt?: string;
  className?: string;
}

/** Renders signature with strong contrast boost for pale scans. */
export function SignatureImage({ src, alt = 'Signature', className = '' }: SignatureImageProps) {
  const [enhancedSrc, setEnhancedSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new window.Image();
    // Same-origin /api/files needs session cookies; crossOrigin blocks them.
    if (src.startsWith('http')) {
      try {
        const url = new URL(src);
        if (url.origin !== window.location.origin) {
          img.crossOrigin = 'anonymous';
        }
      } catch {
        /* relative URL — same origin */
      }
    }
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        enhanceSignaturePixels(imageData.data, canvas.width, canvas.height);
        ctx.putImageData(imageData, 0, 0);
        if (!cancelled) setEnhancedSrc(canvas.toDataURL('image/png'));
      } catch {
        /* fall back to CSS filters on original src */
      }
    };
    img.src = src;

    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <img
      src={enhancedSrc || src}
      alt={alt}
      className={`memo-signature-img ${className}`.trim()}
    />
  );
}
