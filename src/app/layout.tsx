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
  title: { default: 'Daciana — Cosmetics & stationery', template: '%s | Daciana' },
  description: 'Shop cosmetics, skincare, and stationery at Daciana.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { products } = await getCatalog();
  return (
    // Recorder extensions can add root attributes before hydration. Keep the
    // exception on html so descendants retain normal hydration checks.
    <html lang="en" suppressHydrationWarning>
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
