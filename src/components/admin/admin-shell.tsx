'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Boxes,
  Shapes,
  ClipboardList,
  ArrowUpRight,
  LogOut,
  Truck,
  FileText,
  Bell,
} from 'lucide-react';
import { adminSignOut } from '@/app/admin/actions';
import { AdminBrand } from './admin-brand';
const links = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/inventory', label: 'Inventory', icon: Boxes },
  { href: '/admin/categories', label: 'Categories', icon: Shapes },
  { href: '/admin/orders', label: 'Order requests', icon: ClipboardList },
  { href: '/admin/shipping', label: 'Shipping', icon: Truck },
  { href: '/admin/content', label: 'More content', icon: FileText },
  { href: '/admin/notifications', label: 'Notifications', icon: Bell },
];
export function AdminShell({ email, children }: { email: string; children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <AdminBrand />
        <span className="admin-console-label">Store admin</span>
        <nav aria-label="Admin navigation">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={
                (href === '/admin' ? path === href : path.startsWith(href)) ? 'page' : undefined
              }
            >
              <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <Link className="admin-store-link" href="/">
          Open storefront <ArrowUpRight size={18} strokeWidth={1.5} aria-hidden="true" />
        </Link>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <div>Store administration</div>
          <div className="admin-identity">
            <span title={email}>{email}</span>
            <form action={adminSignOut}>
              <button aria-label="Sign out of admin">
                <LogOut size={18} strokeWidth={1.5} aria-hidden="true" />
                <span>Sign out</span>
              </button>
            </form>
          </div>
        </header>
        <main id="main" className="admin-main">
          {children}
        </main>
      </div>
    </div>
  );
}
