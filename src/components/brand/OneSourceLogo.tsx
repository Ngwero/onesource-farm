const LOGO_ASPECT = 252 / 815;

type OneSourceLogoProps = {
  width?: number;
  className?: string;
  priority?: boolean;
  /** `light` = for light backgrounds; `dark` / `full` = for dark backgrounds */
  variant?: 'light' | 'dark' | 'full';
  centered?: boolean;
};

/** PNG logos use native img so alpha transparency is preserved (Next/Image can flatten it). */
export function OneSourceLogo({
  width = 160,
  className = '',
  priority = false,
  variant = 'light',
  centered = false,
}: OneSourceLogoProps) {
  const src = variant === 'light' ? '/onesource-logo.png' : '/onesource-logo-white.png';
  const height = Math.round(width * LOGO_ASPECT);

  const imgClass = `h-auto w-full object-contain ${centered ? 'object-center' : 'object-left'}`;
  const wrapperClass = `${centered ? 'mx-auto' : ''} ${className}`.trim();

  return (
    <div className={wrapperClass} style={{ maxWidth: width }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="OneSource"
        width={width}
        height={height}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        className={imgClass}
      />
    </div>
  );
}
