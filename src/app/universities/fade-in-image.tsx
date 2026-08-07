'use client';

import { useState } from 'react';
import Image from 'next/image';

export function FadeInImage({
  src,
  alt,
  className = '',
  sizes = '(max-width: 640px) calc(100vw - 32px), (max-width: 1024px) 50vw, 386px',
  onError,
  preload = false,
}: {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  onError?: () => void;
  preload?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <Image
      key={src}
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      quality={60}
      preload={preload}
      onLoad={() => setLoaded(true)}
      onError={() => onError?.()}
      className={`transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
    />
  );
}
