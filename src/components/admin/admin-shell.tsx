'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Tags,
  Boxes,
  Shapes,
  ClipboardList,
  ArrowUpRight,
  LogOut,
  Truck,
  FileText,
  Bell,
  ChevronsUpDown,
  X,
} from 'lucide-react';
import { adminSignOut } from '@/app/admin/actions';
import { AdminBrand } from './admin-brand';
import { useAdminReady } from './form-controls';
import { StoreImage } from '@/components/store-image';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const groups = [
  {
    label: 'Store',
    links: [
      { href: '/admin', label: 'Overview', icon: LayoutDashboard },
      { href: '/admin/orders', label: 'Order requests', icon: ClipboardList },
    ],
  },
  {
    label: 'Catalog',
    links: [
      { href: '/admin/products', label: 'Products', icon: Package },
      { href: '/admin/prices', label: 'Prices', icon: Tags },
      { href: '/admin/inventory', label: 'Inventory', icon: Boxes },
      { href: '/admin/categories', label: 'Categories', icon: Shapes },
    ],
  },
  {
    label: 'Manage',
    links: [
      { href: '/admin/shipping', label: 'Shipping', icon: Truck },
      { href: '/admin/content', label: 'More content', icon: FileText },
      { href: '/admin/notifications', label: 'Notifications', icon: Bell },
    ],
  },
];
function MobileSidebarClose() {
  const { isMobile, setOpenMobile } = useSidebar();
  return isMobile ? (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Close navigation"
      onClick={() => setOpenMobile(false)}
    >
      <X />
    </Button>
  ) : null;
}
function AdminNavigation() {
  const path = usePathname();
  const { setOpenMobile } = useSidebar();
  return (
    <nav aria-label="Admin navigation">
      {groups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.links.map(({ href, label, icon: Icon }) => {
                const active = href === '/admin' ? path === href : path.startsWith(href);
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={label}>
                      <Link
                        href={href}
                        aria-current={active ? 'page' : undefined}
                        onClick={() => setOpenMobile(false)}
                      >
                        <Icon strokeWidth={1.5} />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </nav>
  );
}
export function AdminShell({ email, children }: { email: string; children: React.ReactNode }) {
  const path = usePathname();
  const ready = useAdminReady();
  const current = groups
    .flatMap((group) => group.links)
    .find((item) => (item.href === '/admin' ? path === item.href : path.startsWith(item.href)));
  const detail =
    path === '/admin/products/new'
      ? 'Add product'
      : /^\/admin\/products\/[^/]+/.test(path)
        ? 'Edit product'
        : /^\/admin\/orders\/[^/]+/.test(path)
          ? 'Review request'
          : undefined;
  return (
    <SidebarProvider
      className="admin-shell"
      style={{ '--sidebar-width': '15.5rem' } as React.CSSProperties}
    >
      <Sidebar collapsible="icon" className="admin-sidebar" aria-label="Store sidebar">
        <SidebarHeader className="h-24 flex-row items-center justify-between gap-2 px-5 group-data-[collapsible=icon]:px-2">
          <div className="w-full min-w-0 group-data-[collapsible=icon]:hidden">
            <AdminBrand />
          </div>
          <span className="hidden size-8 group-data-[collapsible=icon]:block">
            <StoreImage
              asset="branding/daciana-monogram.png"
              alt="Daciana"
              width={32}
              height={32}
            />
          </span>
          <MobileSidebarClose />
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent className="px-2 py-3">
          <AdminNavigation />
        </SidebarContent>
        <SidebarFooter className="p-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Open storefront">
                <Link href="/" target="_blank" rel="noreferrer">
                  <ArrowUpRight strokeWidth={1.5} />
                  <span>Open storefront</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <div className="px-2 py-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
            Daciana store admin
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0 bg-muted/35">
        <header className="admin-topbar">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger aria-label="Toggle navigation" disabled={!ready} />
            <Separator orientation="vertical" className="h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden sm:block">
                  <BreadcrumbLink asChild>
                    <Link href="/admin">Store</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:block" />
                <BreadcrumbItem>
                  {detail ? (
                    <BreadcrumbLink asChild>
                      <Link href={current?.href ?? '/admin'}>{current?.label}</Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{current?.label ?? 'Overview'}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
                {detail ? (
                  <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{detail}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                ) : null}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-10 gap-2"
                aria-label="Admin account"
                disabled={!ready}
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-xs font-medium">
                  {email.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden max-w-48 truncate text-xs sm:inline">{email}</span>
                <ChevronsUpDown className="size-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>
                <span className="block text-xs font-normal text-muted-foreground">
                  Signed in as
                </span>
                <span className="block truncate py-1 text-sm">{email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <form action={adminSignOut}>
                <DropdownMenuItem asChild onSelect={(event) => event.preventDefault()}>
                  <button type="submit" className="w-full" aria-label="Sign out of admin">
                    <LogOut />
                    Sign out
                  </button>
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main id="main" className="admin-main">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
