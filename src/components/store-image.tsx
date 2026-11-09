'use client';
import Image from 'next/image';
import { useState, type ComponentProps } from 'react';
import assets from '@/lib/store-assets.json';
import { MEDIA_BUCKET } from '@/lib/media';

type Props = Omit<ComponentProps<typeof Image>, 'src' | 'onError'> & { asset: keyof typeof assets };

export function StoreImage({ asset, alt, ...props }: Props) {
  const [failed, setFailed] = useState<string | null>(null);
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const local = `/${asset}`;
  const src =
    base && failed !== asset
      ? `${base}/storage/v1/object/public/${MEDIA_BUCKET}/${assets[asset]}`
      : local;
  // The small bundled copy keeps branding usable offline or during a Storage outage.
  return <Image {...props} alt={alt} src={src} unoptimized onError={() => setFailed(asset)} />;
}
