interface SignatureImageProps {
  src: string;
  alt?: string;
  className?: string;
}

export function SignatureImage({ src, alt = 'Signature', className = '' }: SignatureImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      className={`memo-signature-img ${className}`.trim()}
    />
  );
}
