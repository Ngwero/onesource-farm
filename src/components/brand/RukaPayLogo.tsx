import Image from 'next/image';

const LOGO_ASPECT = 465 / 1024;

type RukaPayLogoProps = {
  width?: number;
  className?: string;
  priority?: boolean;
  variant?: 'light' | 'dark' | 'full';
  centered?: boolean;
};

/** PNG logos use native img so alpha transparency is preserved (Next/Image can flatten it). */
export function RukaPayLogo({
  width = 160,
  className = '',
  priority = false,
  variant = 'light',
  centered = false,
}: RukaPayLogoProps) {
  const src =
    variant === 'full'
      ? '/rukapay-logo-full.png'
      : variant === 'dark'
        ? '/rukapay-logo-white.png'
        : '/rukapay-logo.png';

  const height =
    variant === 'full' ? Math.round(width * LOGO_ASPECT) : Math.round(width * 0.34);

  const imgClass = `h-auto w-full object-contain ${centered ? 'object-center' : 'object-left'}`;

  const wrapperClass = `${centered ? 'mx-auto' : ''} ${className}`.trim();

  if (variant === 'full' || variant === 'dark') {
    return (
      <div className={wrapperClass} style={{ maxWidth: width }}>
        {/* Native img keeps transparent PNG background on glass UI */}
        <img
          src={src}
          alt="RukaPay — Seamless Payments"
          width={width}
          height={height}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          className={imgClass}
        />
      </div>
    );
  }

  return (
    <div className={wrapperClass} style={{ maxWidth: width }}>
      <Image
        src={src}
        alt="RukaPay — Seamless Payments"
        width={width}
        height={height}
        priority={priority}
        className={imgClass}
      />
    </div>
  );
}
