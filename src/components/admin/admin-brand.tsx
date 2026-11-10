import Link from 'next/link';
import { StoreImage } from '@/components/store-image';

export function AdminBrand({ className = '' }: { className?: string }) {
  return (
    <Link href="/admin" className={`admin-brand ${className}`} aria-label="Daciana admin home">
      <span className="header-logo">
        <StoreImage
          asset="branding/daciana-logo-transparent.png"
          alt="Daciana — Stationery & Cosmetics"
          width={1774}
          height={887}
          sizes="208px"
          loading="eager"
        />
      </span>
    </Link>
  );
}
