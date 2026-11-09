import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ShopProvider } from '@/components/shop-provider';
import { Header, BottomNav, ViewportBehavior } from '@/components/shell';
import { getCatalog } from '@/lib/catalog';
import { Suspense } from 'react';
import { StoreLoading } from '@/components/store-loading';
export const dynamic = 'force-dynamic';
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#faf9f7',
  colorScheme: 'light',
  interactiveWidget: 'resizes-content',
};

export const metadata: Metadata = {
  title: { default: 'Daciana — Cosmetics & stationery', template: '%s | Daciana' },
  description: 'Shop cosmetics, skincare, and stationery at Daciana.',
};

async function Storefront({ children }: { children: React.ReactNode }) {
  const { products } = await getCatalog();
  return (
    <ShopProvider products={products.map((product) => ({ ...product, description: null }))}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      <div className="app-content">{children}</div>
      <BottomNav />
      <ViewportBehavior />
    </ShopProvider>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Recorder extensions can add root attributes before hydration. Keep the
    // exception on html so descendants retain normal hydration checks.
    <html lang="en" suppressHydrationWarning>
      <body>
        <Suspense fallback={<StoreLoading />}>
          <Storefront>{children}</Storefront>
        </Suspense>
      </body>
    </html>
  );
}
