import { Component, useEffect, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HashRouter, Route, Routes, useLocation, useParams, useNavigate } from 'react-router-dom';
import { Header, BottomNav, ViewportBehavior } from '@/components/shell';
import { ShopProvider } from '@/components/shop-provider';
import Loading from '@/app/loading';
import NotFound from '@/app/not-found';
import { fetchCatalog } from './data';
import { Runtime } from './runtime';
import { SessionProvider, useSession } from './session';
import { queryClient } from './query';
import { RouteNotFound, RouteRedirect } from './navigation';
import { signOut } from './actions/auth';

type ScreenName =
  | 'home'
  | 'categories'
  | 'shop'
  | 'saved'
  | 'bag'
  | 'product'
  | 'account'
  | 'addresses'
  | 'checkout'
  | 'more'
  | 'information';

// The existing server pages are hook-free async renderers. In this build they
// run as client data loaders; all server APIs/actions have explicit native adapters.
async function renderScreen(name: ScreenName, slug: string, search: string): Promise<ReactNode> {
  const searchParams = Promise.resolve(Object.fromEntries(new URLSearchParams(search)));
  const params = Promise.resolve({ slug });
  switch (name) {
    case 'home':
      return (await import('@/app/page')).default();
    case 'categories':
      return (await import('@/app/categories/page')).default();
    case 'shop':
      return (await import('@/app/shop/page')).default({ searchParams });
    case 'saved':
      return (await import('@/app/saved/page')).default();
    case 'bag':
      return (await import('@/app/bag/page')).default();
    case 'product':
      return (await import('@/app/product/[slug]/page')).default({ params });
    case 'account':
      return (await import('@/app/account/page')).default({ searchParams });
    case 'addresses':
      return (await import('@/app/account/addresses/page')).default();
    case 'checkout':
      return (await import('@/app/checkout/page')).default();
    case 'more':
      return (await import('@/app/more/page')).default();
    case 'information':
      return (await import('@/app/more/[slug]/page')).default({ params });
  }
}

function RetryScreen({ message }: { message?: string }) {
  const { user } = useSession();
  return (
    <main id="main" className="page-width empty-state">
      <h1>{navigator.onLine ? 'The shop couldn’t load.' : 'You’re offline'}</h1>
      <p>{message || 'Reconnect and try again. Your bag is saved on this device.'}</p>
      <button
        type="button"
        className="button button-dark"
        onClick={() => {
          void queryClient.invalidateQueries();
        }}
      >
        Try again
      </button>
      {user ? (
        <button
          type="button"
          className="text-link native-signout-retry"
          onClick={() => {
            void signOut();
          }}
        >
          Sign out on this device
        </button>
      ) : null}
    </main>
  );
}

function Screen({ name }: { name: ScreenName }) {
  const { user, ready, error: sessionError } = useSession();
  const location = useLocation();
  const params = useParams();
  const navigate = useNavigate();
  const screen = useQuery({
    queryKey: ['screen', user?.id ?? 'guest', location.pathname, location.search],
    queryFn: () => renderScreen(name, params.slug ?? '', location.search),
    enabled: ready,
    structuralSharing: false,
    retry: false,
  });
  useEffect(() => {
    if (screen.error instanceof RouteRedirect) void navigate(screen.error.path, { replace: true });
  }, [screen.error, navigate]);
  if (sessionError) return <RetryScreen message={sessionError} />;
  if (screen.error instanceof RouteNotFound) return <NotFound />;
  if (screen.error instanceof RouteRedirect) return <Loading />;
  if (screen.isError) return <RetryScreen />;
  if (!ready || screen.isPending) return <Loading />;
  return screen.data;
}

function Storefront() {
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: fetchCatalog });
  return (
    <ShopProvider products={catalog.data?.products ?? []}>
      <Runtime>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Header />
        <div className="app-content">
          <Routes>
            <Route path="/" element={<Screen name="home" />} />
            <Route path="/categories" element={<Screen name="categories" />} />
            <Route path="/shop" element={<Screen name="shop" />} />
            <Route path="/saved" element={<Screen name="saved" />} />
            <Route
              path="/bag"
              element={
                catalog.isPending ? (
                  <Loading />
                ) : catalog.data?.error ? (
                  <RetryScreen />
                ) : (
                  <Screen name="bag" />
                )
              }
            />
            <Route path="/product/:slug" element={<Screen name="product" />} />
            <Route path="/account" element={<Screen name="account" />} />
            <Route path="/account/addresses" element={<Screen name="addresses" />} />
            <Route
              path="/checkout"
              element={
                catalog.isPending ? (
                  <Loading />
                ) : catalog.data?.error ? (
                  <RetryScreen />
                ) : (
                  <Screen name="checkout" />
                )
              }
            />
            <Route path="/more" element={<Screen name="more" />} />
            <Route path="/more/:slug" element={<Screen name="information" />} />
            <Route path="/auth/callback" element={<Loading />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
        <BottomNav />
        <ViewportBehavior />
      </Runtime>
    </ShopProvider>
  );
}

export class NativeErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.error('Daciana renderer failed:', error.name);
  }
  render() {
    return this.state.failed ? (
      <main className="page-width empty-state">
        <h1>The app couldn’t load.</h1>
        <button className="button button-dark" onClick={() => window.location.reload()}>
          Restart app
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}

export function App() {
  return (
    <NativeErrorBoundary>
      <HashRouter>
        <SessionProvider>
          <Storefront />
        </SessionProvider>
      </HashRouter>
    </NativeErrorBoundary>
  );
}
