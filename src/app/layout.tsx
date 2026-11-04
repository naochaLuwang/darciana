import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ShopProvider } from '@/components/shop-provider';
import { Header, BottomNav, ViewportBehavior } from '@/components/shell';
import { getCatalog } from '@/lib/catalog';
export const dynamic = 'force-dynamic';
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#fbf9fd',
  colorScheme: 'light',
  interactiveWidget: 'resizes-content',
};

export const metadata: Metadata = {
  title: { default: 'Darciana — Cosmetics & stationery', template: '%s | Darciana' },
  description: 'Shop cosmetics, skincare, and stationery at Darciana.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { products } = await getCatalog();
  return (
    <html lang="en">
      <body>
        <ShopProvider products={products.map((product) => ({ ...product, description: null }))}>
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          <Header />
          <div className="app-content">{children}</div>
          <BottomNav />
          <ViewportBehavior />
        </ShopProvider>
      </body>
    </html>
  );
}
