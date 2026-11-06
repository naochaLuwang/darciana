/* eslint-disable @next/next/no-img-element -- Native assets use ordinary bundled images. */
import type { ImgHTMLAttributes } from 'react';

type Props = ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  alt: string;
  fill?: boolean;
  priority?: boolean;
  unoptimized?: boolean;
};
export default function AppImage({
  fill,
  priority,
  unoptimized,
  style,
  loading,
  alt,
  ...props
}: Props) {
  void unoptimized;
  return (
    <img
      {...props}
      alt={alt}
      loading={priority ? 'eager' : loading}
      fetchPriority={priority ? 'high' : undefined}
      style={{
        ...(fill
          ? ({ position: 'absolute', inset: 0, width: '100%', height: '100%' } as const)
          : {}),
        ...style,
      }}
    />
  );
}
