'use client';

import { usePathname } from 'next/navigation';
import {
  ScreenSkeleton,
  AdminScreenSkeleton,
  type SkeletonScreen,
  type AdminSkeletonScreen,
} from './screen-skeleton';
import { ShopProvider } from './shop-provider';
import { Header, BottomNav, ViewportBehavior } from './shell';

function RouteSkeleton() {
  const path = usePathname();
  if (path.startsWith('/admin')) {
    const section = path.split('/')[2] || 'overview';
    const detail = path.split('/').length > 3;
    const screen =
      section === 'products' && detail
        ? 'product'
        : section === 'orders' && detail
          ? 'order'
          : section;
    const known: AdminSkeletonScreen[] = [
      'overview',
      'products',
      'product',
      'orders',
      'order',
      'inventory',
      'categories',
      'shipping',
      'content',
    ];
    return (
      <main id="main" className="page-width">
        <AdminScreenSkeleton
          screen={
            known.includes(screen as AdminSkeletonScreen)
              ? (screen as AdminSkeletonScreen)
              : 'overview'
          }
        />
      </main>
    );
  }
  const screen: SkeletonScreen = path.startsWith('/product/')
    ? 'product'
    : path.startsWith('/account/addresses')
      ? 'addresses'
      : path.startsWith('/more/')
        ? 'information'
        : path.startsWith('/auth/')
          ? 'auth'
          : (
              {
                '/categories': 'categories',
                '/shop': 'shop',
                '/saved': 'saved',
                '/bag': 'bag',
                '/checkout': 'checkout',
                '/account': 'account',
                '/more': 'more',
              } as Record<string, SkeletonScreen>
            )[path] || 'home';
  return <ScreenSkeleton screen={screen} />;
}

// Stream the navigation and the matching skeleton while the root catalog loads.
export function StoreLoading() {
  return (
    <ShopProvider products={[]}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      <div className="app-content">
        <RouteSkeleton />
      </div>
      <BottomNav />
      <ViewportBehavior />
    </ShopProvider>
  );
}
