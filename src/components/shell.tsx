'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import {
  ArrowLeft,
  Home,
  LayoutGrid,
  Heart,
  Search,
  ShoppingBag,
  UserRound,
  Ellipsis,
} from 'lucide-react';
import { useShop } from './shop-provider';

const tabs = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/categories', label: 'Categories', icon: LayoutGrid },
  { href: '/saved', label: 'Saved', icon: Heart },
  { href: '/more', label: 'More', icon: Ellipsis },
  { href: '/account', label: 'Account', icon: UserRound },
];

export function Header() {
  const path = usePathname();
  const { count } = useShop();
  if (path.startsWith('/admin')) return null;
  const product = path.startsWith('/product/');
  const checkout = path === '/checkout';
  const information = path.startsWith('/more/');
  const secondary = product || checkout || information || path === '/shop';
  const title = product
    ? 'Product details'
    : checkout
      ? 'Checkout'
      : information
        ? 'Information'
        : path === '/bag'
          ? 'Bag'
          : path === '/account/addresses'
            ? 'Saved addresses'
            : path === '/shop'
              ? 'Shop'
              : tabs.find((tab) => tab.href === path)?.label || 'Darciana';
  return (
    <header className="app-header">
      <div className="app-topbar page-width">
        <div className="app-topbar-title">
          {secondary ? (
            <Link
              href={
                information
                  ? '/more'
                  : checkout
                    ? '/bag'
                    : path === '/shop'
                      ? '/categories'
                      : '/shop'
              }
              className="icon-button back-button"
              aria-label={
                information
                  ? 'Back to More'
                  : checkout
                    ? 'Back to bag'
                    : path === '/shop'
                      ? 'Back to categories'
                      : 'Back to shop'
              }
            >
              <ArrowLeft size={21} />
            </Link>
          ) : null}
          {path === '/' ? (
            <Link href="/" className="wordmark" aria-label="Darciana home">
              darciana<span>✳</span>
            </Link>
          ) : (
            <span className="screen-title">{title}</span>
          )}
        </div>
        <div className="app-topbar-actions">
          {path !== '/shop' ? (
            <Link href="/shop" className="icon-button" aria-label="Search the shop">
              <Search size={21} />
            </Link>
          ) : null}
          {path !== '/bag' && !checkout ? (
            <Link
              href="/bag"
              className="icon-button topbar-bag"
              aria-label={`Shopping bag, ${count} items`}
            >
              <ShoppingBag size={21} />
              {count > 0 ? (
                <span className="count-badge" aria-hidden="true">
                  {count > 99 ? '99+' : count}
                </span>
              ) : null}
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export function BottomNav() {
  const path = usePathname();
  if (path.startsWith('/admin')) return null;
  return (
    <nav className="app-bottom-nav" aria-label="App navigation">
      <div className="tab-items">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active =
            href === '/categories'
              ? path === '/categories' || path === '/shop' || path.startsWith('/product/')
              : href === '/more'
                ? path === '/more' || path.startsWith('/more/')
                : href === '/account'
                  ? path.startsWith('/account')
                  : path === href;
          return (
            <Link
              key={href}
              href={href}
              className={`app-tab ${active ? 'active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <span className="tab-icon">
                <Icon
                  size={22}
                  strokeWidth={active ? 2 : 1.7}
                  fill={active && href === '/saved' ? 'currentColor' : 'none'}
                />
              </span>
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// Avoid putting app navigation above a virtual keyboard. Native keyboard events
// can be connected here when the Capacitor project is added.
export function ViewportBehavior() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let fullHeight = window.innerHeight;
    const update = () => {
      const editable = document.activeElement?.matches('input, textarea, [contenteditable="true"]');
      if (!editable) fullHeight = Math.max(fullHeight, window.innerHeight);
      const keyboard = !!editable && fullHeight - viewport.height > 140;
      document.documentElement.dataset.keyboard = keyboard ? 'open' : 'closed';
    };
    const onOrientation = () => {
      fullHeight = window.innerHeight;
      update();
    };
    update();
    viewport.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    window.addEventListener('orientationchange', onOrientation);
    return () => {
      viewport.removeEventListener('resize', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
      window.removeEventListener('orientationchange', onOrientation);
      delete document.documentElement.dataset.keyboard;
    };
  }, []);
  return null;
}
