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
        <Link href="/admin" className="wordmark">
          darciana<span>✳</span>
        </Link>
        <span className="admin-console-label">STORE CONSOLE</span>
        <nav aria-label="Admin navigation">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={
                (href === '/admin' ? path === href : path.startsWith(href)) ? 'page' : undefined
              }
            >
              <Icon size={19} strokeWidth={1.7} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <Link className="admin-store-link" href="/">
          Open storefront <ArrowUpRight size={15} />
        </Link>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <span className="admin-owner-dot" />
            Owner workspace
          </div>
          <div className="admin-identity">
            <span>{email}</span>
            <form action={adminSignOut}>
              <button aria-label="Sign out of admin">
                <LogOut size={17} />
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
