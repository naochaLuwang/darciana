import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/admin/common';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowRight, Plus, ClipboardList } from 'lucide-react';
import { adminSession, type AdminOrder } from '@/lib/admin';
import { money } from '@/lib/commerce';
import { AdminHeading, AdminNotice, adminDate } from '@/components/admin/common';
export default async function AdminOverview() {
  const session = await adminSession();
  if (!session) return null;
  const [summary, recent, activity] = await Promise.all([
    session.db.rpc('storefront_admin_overview'),
    session.db
      .from('storefront_order_requests')
      .select(
        'id,shipping,item_total,order_total,shipping_price,shipping_area_name,status,created_at',
      )
      .order('created_at', { ascending: false })
      .limit(5),
    session.db
      .from('storefront_admin_activity')
      .select('id,action,label,created_at')
      .order('created_at', { ascending: false })
      .limit(6),
  ]);
  const data = summary.data as {
    active_products: number;
    low_stock: number;
    pending_requests: number;
    requested_value: number;
  } | null;
  const cards = data
    ? [
        {
          label: 'Active products',
          value: data.active_products,
          note: 'Visible in the shop',
          href: '/admin/products?status=active',
        },
        {
          label: 'Low stock options',
          value: data.low_stock,
          note: '5 units or fewer · active products',
          href: '/admin/inventory?low=true',
        },
        {
          label: 'Awaiting confirmation',
          value: data.pending_requests,
          note: 'Requests needing your attention',
          attention: data.pending_requests > 0,
          href: '/admin/orders?status=awaiting_confirmation',
        },
        {
          label: 'Requested item value',
          value: money(data.requested_value),
          note: 'Last 30 days · excludes cancelled',
          href: '/admin/orders',
        },
      ]
    : [];
  return (
    <>
      <AdminHeading
        title="Store overview"
        description="Orders and inventory at a glance"
        action={
          <Button asChild>
            <Link href="/admin/products/new">
              <Plus size={16} />
              Add product
            </Link>
          </Button>
        }
      />
      {summary.error ? (
        <AdminNotice>Overview data could not load. Refresh and try again.</AdminNotice>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ label, value, note, attention, href }) => (
            <Card
              key={label}
              className={
                attention ? 'gap-0 border-primary/30 py-0 shadow-xs' : 'gap-0 py-0 shadow-xs'
              }
            >
              <Link href={href} className="group block space-y-4 p-5">
                <span className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                  {label}
                  <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
                <strong
                  className={
                    attention
                      ? 'block text-3xl font-semibold tracking-tight text-primary'
                      : 'block text-3xl font-semibold tracking-tight'
                  }
                >
                  {value}
                </strong>
                <span className="block text-xs text-muted-foreground">{note}</span>
              </Link>
            </Card>
          ))}
        </div>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="min-w-0 gap-0 overflow-hidden py-0">
          <CardHeader className="admin-panel-heading">
            <div>
              <h2 className="font-semibold">Recent order requests</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                The latest orders placed in your store
              </p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/orders">
                View all
                <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          {recent.error ? (
            <div className="p-5">
              <AdminNotice>Order requests could not load.</AdminNotice>
            </div>
          ) : recent.data?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>
                    <span className="sr-only">Review</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(recent.data as AdminOrder[]).map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Link href={`/admin/orders/${order.id}`} className="flex items-center gap-3">
                        <span
                          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-sm font-medium"
                          aria-hidden="true"
                        >
                          {order.shipping.name.slice(0, 1).toUpperCase()}
                        </span>
                        <div>
                          <strong className="block font-medium">{order.shipping.name}</strong>
                          <span className="block text-xs text-muted-foreground">
                            #{order.id.slice(0, 8).toUpperCase()} · {adminDate(order.created_at)}
                          </span>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={order.status} />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {money(order.order_total ?? order.item_total)}
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="icon-sm">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          aria-label={`Review request ${order.id.slice(0, 8)}`}
                        >
                          <ArrowRight />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="admin-empty">
              <ClipboardList className="size-7 text-muted-foreground" />
              <h3>No requests yet</h3>
              <p>New customer orders will appear here</p>
            </div>
          )}
        </Card>
        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="admin-panel-heading">
            <h2 className="font-semibold">Store activity</h2>
          </CardHeader>
          {activity.error ? (
            <div className="p-5">
              <AdminNotice>Activity could not load.</AdminNotice>
            </div>
          ) : activity.data?.length ? (
            <ul className="divide-y divide-border">
              {activity.data.map((entry) => (
                <li key={entry.id} className="space-y-1 px-5 py-4">
                  <p className="text-sm font-medium capitalize">
                    {entry.action.replaceAll('_', ' ')}
                  </p>
                  <p className="text-sm text-muted-foreground">{entry.label}</p>
                  <time
                    className="block pt-1 text-xs text-muted-foreground"
                    dateTime={entry.created_at}
                  >
                    {adminDate(entry.created_at)}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <div className="admin-empty">
              <h3>No recent activity</h3>
              <p>Catalog and order changes appear here</p>
            </div>
          )}
        </Card>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Requested item value covers the last 30 days and excludes delivery and cancelled orders. It
        is not collected revenue.
      </p>
    </>
  );
}
