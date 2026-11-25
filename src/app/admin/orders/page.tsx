import Link from 'next/link';
import { Search } from 'lucide-react';
import {
  StatusBadge,
  AdminHeading,
  AdminNotice,
  Pagination,
  adminDate,
} from '@/components/admin/common';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { adminSession, type AdminOrder } from '@/lib/admin';
import { money } from '@/lib/commerce';
import { paymentLabel } from '@/lib/payment';
import { OrderFiltersPanel } from '@/components/admin/order-filters-panel';
import { orderStatusLabel } from '@/lib/order-status';
import {
  parseOrderFilters,
  orderFilterHref,
  orderDatePresets,
  activeOrderStatuses,
  orderQueryStatus,
} from '@/lib/order-filters';

export const metadata = { title: 'Order requests' };
type Dashboard = {
  orders: AdminOrder[];
  count: number;
  page: number;
  counts: Record<string, number>;
  summary: { total: number; pending: number; order_value: number; unpaid_value: number };
};
export default async function Orders({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await adminSession();
  if (!session) return null;
  const filters = parseOrderFilters(await searchParams);
  const result = filters.error
    ? null
    : await session.db.rpc('storefront_admin_orders', {
        p_from: filters.fromInstant,
        p_to: filters.toInstant,
        p_q: filters.q,
        p_status: orderQueryStatus(filters),
        p_payment: filters.payment,
        p_mode: filters.mode,
        p_sort: filters.sort,
        p_page: filters.page,
      });
  const data = result?.error ? null : (result?.data as Dashboard | null);
  const tabs = [
    { value: 'pending', label: 'Pending', count: data?.counts.awaiting_confirmation ?? 0 },
    {
      value: 'active',
      label: 'Active',
      count: activeOrderStatuses.reduce((sum, status) => sum + (data?.counts[status] ?? 0), 0),
    },
    { value: 'cancelled', label: 'Cancelled', count: data?.counts.cancelled ?? 0 },
  ] as const;
  const clearHref = orderFilterHref(parseOrderFilters({ tab: filters.tab }));
  const active = !!(
    filters.q ||
    filters.payment ||
    filters.mode ||
    filters.from ||
    filters.to ||
    filters.status ||
    filters.sort !== 'newest'
  );
  const metrics = data
    ? [
        { label: 'Total orders', value: data.summary.total, note: 'Across all statuses' },
        { label: 'Pending orders', value: data.summary.pending, note: 'Waiting to be processed' },
        {
          label: 'Order value',
          value: money(data.summary.order_value),
          note: 'Excludes cancelled orders',
        },
        {
          label: 'Unpaid value',
          value: money(data.summary.unpaid_value),
          note: 'Excludes cancelled orders',
        },
      ]
    : [];
  return (
    <>
      <AdminHeading
        title="Order requests"
        description="Track requests, deliveries and payments. All dates use IST."
      />
      {data && (
        <section aria-label="Order overview" className="admin-orders-overview">
          <dl className="admin-orders-metrics">
            {metrics.map((metric) => (
              <div key={metric.label} title={metric.note}>
                <dt>{metric.label}</dt>
                <dd>{metric.value}</dd>
              </div>
            ))}
          </dl>
          <p className="admin-orders-scope">
            Current filters, all statuses · Value totals exclude cancelled orders
          </p>
        </section>
      )}
      <Card className="admin-orders-panel gap-0 overflow-hidden py-0">
        <form
          key={orderFilterHref(filters)}
          action="/admin/orders"
          className="admin-orders-filters"
        >
          <input type="hidden" name="tab" value={filters.tab} />
          <OrderFiltersPanel
            appliedCount={
              [
                !!(filters.from || filters.to),
                !!filters.payment,
                !!filters.mode,
                filters.sort !== 'newest',
              ].filter(Boolean).length
            }
            initiallyExpanded={!!filters.error}
            stage={
              filters.tab === 'active' && (
                <label className="admin-orders-active-filter">
                  <span className="sr-only">Active status</span>
                  <NativeSelect
                    name="status"
                    aria-label="Active status"
                    defaultValue={filters.status}
                  >
                    <NativeSelectOption value="">All active statuses</NativeSelectOption>
                    {activeOrderStatuses.map((status) => (
                      <NativeSelectOption key={status} value={status}>
                        {orderStatusLabel(status)}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </label>
              )
            }
            search={
              <label className="admin-orders-search">
                <span className="sr-only">Find an order</span>
                <div>
                  <Search aria-hidden="true" />
                  <Input
                    type="search"
                    name="q"
                    defaultValue={filters.q}
                    placeholder="Order ID, customer name or phone"
                    maxLength={80}
                  />
                </div>
              </label>
            }
            actions={
              <div className="admin-orders-filter-actions">
                <Button size="sm" aria-label="Apply filters">
                  Apply
                </Button>
                {active && (
                  <Link className="text-link" aria-label="Clear filters" href={clearHref}>
                    Clear
                  </Link>
                )}
              </div>
            }
          >
            <label>
              <span>From date</span>
              <Input type="date" name="from" defaultValue={filters.from} />
            </label>
            <label>
              <span>To date</span>
              <Input type="date" name="to" defaultValue={filters.to} />
            </label>
            <label>
              <span>Payment status</span>
              <NativeSelect
                name="payment"
                aria-label="Payment status"
                defaultValue={filters.payment}
              >
                <NativeSelectOption value="">All payments</NativeSelectOption>
                <NativeSelectOption value="unpaid">Unpaid</NativeSelectOption>
                <NativeSelectOption value="paid">Paid</NativeSelectOption>
              </NativeSelect>
            </label>
            <label>
              <span>Payment mode</span>
              <NativeSelect name="mode" aria-label="Payment mode" defaultValue={filters.mode}>
                <NativeSelectOption value="">All payment modes</NativeSelectOption>
                <NativeSelectOption value="cash_on_delivery">Cash on delivery</NativeSelectOption>
                <NativeSelectOption value="manual_upi">Manual UPI</NativeSelectOption>
                <NativeSelectOption value="unrecorded">Not recorded</NativeSelectOption>
              </NativeSelect>
            </label>
            <label>
              <span>Sort orders</span>
              <NativeSelect name="sort" aria-label="Sort orders" defaultValue={filters.sort}>
                <NativeSelectOption value="newest">Newest first</NativeSelectOption>
                <NativeSelectOption value="oldest">Oldest first</NativeSelectOption>
                <NativeSelectOption value="highest_total">Highest total</NativeSelectOption>
                <NativeSelectOption value="lowest_total">Lowest total</NativeSelectOption>
              </NativeSelect>
            </label>

            <nav className="admin-orders-date-presets" aria-label="Order date ranges">
              <span>Quick dates</span>
              {orderDatePresets().map((preset) => (
                <Link
                  key={preset.label}
                  prefetch={false}
                  href={orderFilterHref(filters, { from: preset.from, to: preset.to, page: 1 })}
                  aria-current={
                    filters.from === preset.from && filters.to === preset.to ? 'date' : undefined
                  }
                >
                  {preset.label}
                </Link>
              ))}
            </nav>
          </OrderFiltersPanel>
        </form>
        {filters.error ? (
          <div className="p-5">
            <AdminNotice>{filters.error}</AdminNotice>
          </div>
        ) : !data ? (
          <div className="p-5">
            <AdminNotice>
              Orders could not load. Apply the order fulfilment database upgrade if setup is
              pending, then refresh.
            </AdminNotice>
          </div>
        ) : (
          <>
            <nav className="admin-orders-tabs" aria-label="Order statuses">
              {tabs.map((tab) => (
                <Link
                  key={tab.value}
                  prefetch={false}
                  href={orderFilterHref(filters, { tab: tab.value, status: '', page: 1 })}
                  aria-current={filters.tab === tab.value ? 'page' : undefined}
                  aria-label={`${tab.label}, ${tab.count} orders`}
                >
                  {tab.label}
                  <span>{tab.count}</span>
                </Link>
              ))}
            </nav>
            {data.orders.length ? (
              <Table className="admin-orders-table" aria-label="Order requests">
                <TableHeader>
                  <TableRow>
                    <TableHead>Request</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Received (IST)</TableHead>
                    <TableHead>
                      <span className="sr-only">View request</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="admin-orders-request">
                        <Link href={`/admin/orders/${order.id}`}>
                          <strong>#{order.id.slice(0, 8).toUpperCase()}</strong>
                          <small>
                            {order.items.reduce((sum, item) => sum + item.quantity, 0)} items
                          </small>
                        </Link>
                      </TableCell>
                      <TableCell className="admin-orders-customer">
                        <strong>{order.shipping.name}</strong>
                        <small>{order.shipping.city}</small>
                        <a href={`tel:${order.shipping.phone.replace(/[^+0-9]/g, '')}`}>
                          {order.shipping.phone}
                        </a>
                      </TableCell>
                      <TableCell className="admin-orders-status">
                        <StatusBadge status={order.status}>
                          {orderStatusLabel(order.status)}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="admin-orders-payment">
                        <StatusBadge status={order.payment_status}>
                          {order.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                        </StatusBadge>
                        <small>{paymentLabel(order.shipping.payment_mode)}</small>
                      </TableCell>
                      <TableCell className="admin-orders-total">
                        <strong>{money(order.order_total ?? order.item_total)}</strong>
                        <small>
                          {order.order_total == null
                            ? 'Delivery not yet priced'
                            : order.shipping_price === 0
                              ? 'Free delivery'
                              : `Incl. ${money(order.shipping_price ?? 0)} delivery`}
                        </small>
                      </TableCell>
                      <TableCell className="admin-orders-date">
                        {adminDate(order.created_at)}
                      </TableCell>
                      <TableCell className="admin-orders-review">
                        <Link className="text-link" href={`/admin/orders/${order.id}`}>
                          Review →
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="admin-empty">
                <h2>No orders match these filters</h2>
                <p>Try another status, widen the date range or clear the filters.</p>
                <Link
                  className="text-link"
                  href={orderFilterHref(
                    parseOrderFilters({ tab: filters.tab === 'active' ? 'pending' : 'active' }),
                  )}
                >
                  {filters.tab === 'active' ? 'View pending orders' : 'View active orders'}
                </Link>
              </div>
            )}
            <Pagination
              page={data.page}
              count={data.count}
              href={orderFilterHref(filters, { page: 1 })}
            />
          </>
        )}
      </Card>
    </>
  );
}
