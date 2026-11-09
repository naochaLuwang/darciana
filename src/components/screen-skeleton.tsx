import type { CSSProperties, ReactNode } from 'react';

export type SkeletonScreen =
  | 'home'
  | 'categories'
  | 'shop'
  | 'saved'
  | 'bag'
  | 'product'
  | 'account'
  | 'addresses'
  | 'checkout'
  | 'checkout-signin'
  | 'more'
  | 'information'
  | 'signin'
  | 'auth';

const labels: Record<SkeletonScreen, string> = {
  home: 'home',
  categories: 'categories',
  shop: 'products',
  saved: 'saved items',
  bag: 'shopping bag',
  product: 'product details',
  account: 'profile',
  addresses: 'saved addresses',
  checkout: 'checkout',
  'checkout-signin': 'checkout',
  more: 'More',
  information: 'information',
  signin: 'sign-in',
  auth: 'sign-in',
};

function Bone({
  width,
  height = 16,
  className = '',
}: {
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  className?: string;
}) {
  return <span className={`skeleton-shape ${className}`} style={{ width, height }} />;
}
function Stack({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`skeleton-stack ${className}`}>{children}</div>;
}
function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="skeleton-panel">
      <Stack>{children}</Stack>
    </div>
  );
}
function Fields({ count = 2 }: { count?: number }) {
  return (
    <Stack>
      {Array.from({ length: count }, (_, index) => (
        <Stack key={index} className="skeleton-field">
          <Bone width="32%" height={12} />
          <Bone height={48} />
        </Stack>
      ))}
    </Stack>
  );
}
function Rows({ count = 3 }: { count?: number }) {
  return (
    <Stack>
      {Array.from({ length: count }, (_, index) => (
        <div className="skeleton-row" key={index}>
          <Bone width={40} height={40} />
          <Stack className="skeleton-grow">
            <Bone width="65%" />
            <Bone width="40%" height={12} />
          </Stack>
          <Bone width={16} height={16} />
        </div>
      ))}
    </Stack>
  );
}
function Products({ count = 4 }: { count?: number }) {
  return (
    <div className="product-grid">
      {Array.from({ length: count }, (_, index) => (
        <div className="product-card" key={index}>
          <Bone height="auto" className="product-photo" />
          <Stack className="skeleton-product-meta">
            <Bone width="36%" height={10} />
            <Bone />
            <Bone width="75%" />
            <Bone width="45%" height={20} />
            <Bone height={44} />
          </Stack>
        </div>
      ))}
    </div>
  );
}
function Catalog({ saved = false }: { saved?: boolean }) {
  return (
    <Stack className="skeleton-section">
      <Bone width="55%" height={30} />
      <Bone height={50} />
      {!saved ? (
        <div className="skeleton-row">
          <Bone width={88} height={44} />
          <Bone width={88} height={44} />
          <Bone width={88} height={44} />
        </div>
      ) : null}
      <div className="skeleton-row skeleton-between">
        <Bone width={80} height={44} />
        <Bone width={112} height={24} />
      </div>
      <Bone width={84} height={12} />
      <Products />
    </Stack>
  );
}
function Home() {
  return (
    <>
      <div className="home-welcome">
        <Bone width="50%" height={30} />
      </div>
      <div className="home-discovery">
        <Bone height={50} />
        <div className="home-shortcuts skeleton-shortcuts">
          {[0, 1, 2, 3].map((index) => (
            <Stack key={index}>
              <Bone width={60} height={60} className="skeleton-circle" />
              <Bone width={64} height={12} />
            </Stack>
          ))}
        </div>
      </div>
      <Bone height="auto" className="home-campaign" />
      <div className="home-picks">
        <div className="section-heading">
          <Bone width="58%" height={24} />
          <Bone width={64} />
        </div>
        <Products />
      </div>
    </>
  );
}
function Categories() {
  return (
    <Stack className="skeleton-section">
      <Bone width="70%" height={30} />
      {[0, 1].map((group) => (
        <div className="category-group" key={group}>
          <Stack>
            <div className="skeleton-row">
              <Bone width={48} height={48} />
              <Stack>
                <Bone width={120} height={22} />
                <Bone width={80} height={12} />
              </Stack>
            </div>
            <div className="category-tile-grid">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <Stack key={index}>
                  <Bone height="auto" className="skeleton-square" />
                  <Bone width="70%" height={12} />
                </Stack>
              ))}
            </div>
          </Stack>
        </div>
      ))}
    </Stack>
  );
}
function Summary() {
  return (
    <Stack>
      <Bone width="55%" height={22} />
      {[0, 1, 2].map((index) => (
        <div key={index} className="skeleton-row skeleton-between">
          <Bone width="45%" />
          <Bone width={64} />
        </div>
      ))}
      <Bone height={1} />
      <div className="skeleton-row skeleton-between">
        <Bone width="35%" height={24} />
        <Bone width={88} height={24} />
      </div>
    </Stack>
  );
}
function Bag() {
  return (
    <Stack className="skeleton-section">
      <Bone width={160} height={30} />
      <div className="bag-layout skeleton-layout">
        <Stack>
          {[0, 1, 2].map((index) => (
            <div className="skeleton-row skeleton-bag-row" key={index}>
              <Bone width={84} height={104} />
              <Stack className="skeleton-grow">
                <Bone width="80%" />
                <Bone width="55%" height={12} />
                <Bone width={72} height={20} />
                <Bone width={112} height={36} />
              </Stack>
            </div>
          ))}
        </Stack>
        <Panel>
          <Summary />
          <Bone height={48} />
        </Panel>
      </div>
    </Stack>
  );
}
function Product() {
  return (
    <div className="product-detail">
      <Bone height="auto" className="detail-photo skeleton-square" />
      <Stack className="skeleton-section detail-copy">
        <Bone width="25%" height={12} />
        <Bone width="90%" height={28} />
        <Bone width="70%" height={28} />
        <Bone width={136} height={32} />
        <Bone width={112} height={12} />
        <Bone width="40%" height={18} />
        <div className="skeleton-row">
          <Bone width={48} height={48} />
          <Bone width={48} height={48} />
          <Bone width={48} height={48} />
        </div>
        <Bone height={48} />
        <Bone />
        <Bone />
        <Bone width="75%" />
      </Stack>
    </div>
  );
}
function Profile() {
  return (
    <Stack className="skeleton-section">
      <div className="skeleton-row">
        <Bone width={56} height={56} className="skeleton-circle" />
        <Stack className="skeleton-grow">
          <Bone width={88} height={12} />
          <Bone width="65%" height={26} />
          <Bone width="80%" height={12} />
        </Stack>
      </div>
      <Panel>
        <Bone width={120} height={22} />
        <Fields />
        <Bone height={48} />
      </Panel>
      <Panel>
        <Rows count={1} />
      </Panel>
      <Bone width={112} height={24} />
      <Panel>
        <Rows count={2} />
        <Bone height={1} />
        <Summary />
      </Panel>
    </Stack>
  );
}
function Addresses() {
  return (
    <Stack className="skeleton-section">
      <Bone width={100} />
      <div className="skeleton-row skeleton-between">
        <Bone width="50%" height={28} />
        <Bone width={100} height={44} />
      </div>
      {[0, 1].map((index) => (
        <Panel key={index}>
          <Rows count={1} />
          <Bone width="80%" />
          <Bone width="65%" />
          <Bone width="45%" />
        </Panel>
      ))}
    </Stack>
  );
}
function Checkout() {
  return (
    <Stack className="skeleton-section skeleton-checkout">
      <Panel>
        <Bone width={136} height={22} />
        <Bone height={76} />
        <Bone width={104} height={12} />
        <Bone height={48} />
      </Panel>
      <Panel>
        <Summary />
      </Panel>
      <Panel>
        <Bone width={152} height={22} />
        <Rows count={1} />
      </Panel>
      <Bone width="90%" height={20} />
      <Bone height={48} />
    </Stack>
  );
}
function SignIn({ checkout = false }: { checkout?: boolean }) {
  return (
    <div className="skeleton-auth">
      <Panel>
        <Bone width="60%" height={48} className="skeleton-centered" />
        <Bone width="70%" height={30} className="skeleton-centered" />
        <Bone width="85%" height={16} className="skeleton-centered" />
        <Bone height={48} />
        {!checkout ? (
          <>
            <Bone height={1} />
            <Fields />
            <Bone height={48} />
          </>
        ) : (
          <Bone height={48} />
        )}
        <Bone width="60%" className="skeleton-centered" />
      </Panel>
    </div>
  );
}
function More() {
  return (
    <Stack className="skeleton-section">
      <Panel>
        <Bone width="85%" height={56} className="skeleton-centered" />
      </Panel>
      {[0, 1].map((index) => (
        <Stack key={index}>
          <Bone width={112} height={14} />
          <Panel>
            <Rows />
          </Panel>
        </Stack>
      ))}
      <Panel>
        <Rows count={1} />
      </Panel>
      <Bone width={88} height={12} className="skeleton-centered" />
    </Stack>
  );
}
function Information() {
  return (
    <Stack className="skeleton-section">
      <Bone width="65%" height={32} />
      {[0, 1, 2].map((index) => (
        <Stack key={index}>
          <Bone />
          <Bone />
          <Bone />
          <Bone width="70%" />
        </Stack>
      ))}
    </Stack>
  );
}

export function ScreenSkeleton({ screen = 'home' }: { screen?: SkeletonScreen }) {
  const content: Record<SkeletonScreen, ReactNode> = {
    home: <Home />,
    categories: <Categories />,
    shop: <Catalog />,
    saved: <Catalog saved />,
    bag: <Bag />,
    product: <Product />,
    account: <Profile />,
    addresses: <Addresses />,
    checkout: <Checkout />,
    'checkout-signin': <SignIn checkout />,
    more: <More />,
    information: <Information />,
    signin: <SignIn />,
    auth: <SignIn />,
  };
  const narrow =
    screen === 'account' || screen === 'addresses' || screen === 'more' || screen === 'information';
  return (
    <main
      id="main"
      className={`page-width screen-skeleton skeleton-screen-${screen}${screen === 'home' ? ' home-screen' : ''}${narrow ? ' skeleton-narrow' : ''}`}
      role="status"
      aria-busy="true"
      data-skeleton={screen}
    >
      <span className="sr-only">Loading {labels[screen]}</span>
      <div aria-hidden="true">{content[screen]}</div>
    </main>
  );
}

export type AdminSkeletonScreen =
  | 'overview'
  | 'products'
  | 'product'
  | 'orders'
  | 'order'
  | 'inventory'
  | 'categories'
  | 'shipping'
  | 'content';
function Table() {
  return (
    <Panel>
      {[0, 1, 2, 3, 4].map((index) => (
        <div className="skeleton-table-row" key={index}>
          <Bone height={index ? 44 : 16} />
          <Bone width="70%" />
          <Bone width="70%" />
          <Bone width="65%" />
        </div>
      ))}
    </Panel>
  );
}
export function AdminScreenSkeleton({ screen }: { screen: AdminSkeletonScreen }) {
  const table = screen === 'products' || screen === 'orders' || screen === 'inventory';
  return (
    <div
      role="status"
      aria-busy="true"
      data-skeleton={`admin-${screen}`}
      className="screen-skeleton skeleton-admin"
    >
      <span className="sr-only">Loading {screen === 'product' ? 'product editor' : screen}</span>
      <Stack className="skeleton-section">
        <div aria-hidden="true">
          <Stack>
            <Bone width={144} height={12} />
            <Bone width="55%" height={32} />
            <Bone width="70%" height={16} />
          </Stack>
        </div>
        <div aria-hidden="true">
          <Stack>
            {table ? (
              <>
                <div className="skeleton-row">
                  <Bone height={44} width="65%" />
                  <Bone height={44} width={120} />
                </div>
                <Table />
              </>
            ) : screen === 'overview' ? (
              <>
                <div className="skeleton-stat-grid">
                  {[0, 1, 2, 3].map((index) => (
                    <Panel key={index}>
                      <Bone width="65%" height={14} />
                      <Bone width="45%" height={36} />
                      <Bone width="80%" height={12} />
                    </Panel>
                  ))}
                </div>
                <Table />
              </>
            ) : screen === 'order' ? (
              <>
                <Panel>
                  <Summary />
                  <Rows count={2} />
                </Panel>
                <Panel>
                  <Fields count={1} />
                  <Bone height={44} />
                </Panel>
              </>
            ) : (
              <>
                <Panel>
                  <Fields count={screen === 'product' ? 5 : screen === 'categories' ? 3 : 2} />
                  {screen === 'content' ? <Bone height={200} /> : null}
                  <Bone height={48} />
                </Panel>
                {screen === 'shipping' || screen === 'categories' ? <Table /> : null}
              </>
            )}
          </Stack>
        </div>
      </Stack>
    </div>
  );
}
