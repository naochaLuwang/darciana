import { StatusBadge } from '@/components/admin/common';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
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
import Link from 'next/link';
import { adminSession, type AdminOrder } from '@/lib/admin';
import { money } from '@/lib/commerce';
import {
  AdminHeading,
  AdminNotice,
  Pagination,
  pageNumber,
  adminDate,
} from '@/components/admin/common';
export const metadata = { title: 'Order requests' };
export default async function Orders({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const session = await adminSession();
  if (!session) return null;
  const params = await searchParams;
  const page = pageNumber(params.page);
  const status = ['awaiting_confirmation', 'confirmed', 'completed', 'cancelled'].includes(
    params.status ?? '',
  )
    ? params.status!
    : '';
  let query = session.db
    .from('storefront_order_requests')
    .select(
      'id,user_id,created_at,status,item_total,shipping_area_name,shipping_price,order_total,shipping,items',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .order('id')
    .range((page - 1) * 25, page * 25 - 1);
  if (status) query = query.eq('status', status);
  const result = await query;
  const orders = (result.data ?? []) as AdminOrder[];
  return (
    <>
      <AdminHeading
        title="Order requests"
        description="Confirm, fulfil and track customer orders"
      />
      <form className="admin-filterbar">
        <NativeSelect name="status" aria-label="Request status" defaultValue={status}>
          <NativeSelectOption value="">All statuses</NativeSelectOption>
          <NativeSelectOption value="awaiting_confirmation">
            Awaiting confirmation
          </NativeSelectOption>
          <NativeSelectOption value="confirmed">Confirmed</NativeSelectOption>
          <NativeSelectOption value="completed">Completed</NativeSelectOption>
          <NativeSelectOption value="cancelled">Cancelled</NativeSelectOption>
        </NativeSelect>
        <Button variant="outline">Apply filter</Button>
      </form>
      {result.error ? (
        <AdminNotice>
          Requests could not load. Run supabase/setup.sql if the order-request setup is still
          pending.
        </AdminNotice>
      ) : (
        <Card className="admin-table-panel gap-0 overflow-hidden py-0">
          <div className="min-w-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Received (IST)</TableHead>
                  <TableHead>
                    <span className="sr-only">View request</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Link href={`/admin/orders/${order.id}`}>
                        <strong>#{order.id.slice(0, 8).toUpperCase()}</strong>
                        <small>
                          {order.items.reduce((sum, item) => sum + item.quantity, 0)} items
                        </small>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <strong>{order.shipping.name}</strong>
                      <small>{order.shipping.city}</small>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={order.status}>
                        {order.status.replaceAll('_', ' ')}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      {money(order.order_total ?? order.item_total)}
                      <small>
                        {order.order_total == null
                          ? 'Delivery not yet priced'
                          : `Includes ${order.shipping_price === 0 ? 'free delivery' : `${money(order.shipping_price ?? 0)} delivery`}`}
                      </small>
                    </TableCell>
                    <TableCell>{adminDate(order.created_at)}</TableCell>
                    <TableCell>
                      <Link className="text-link" href={`/admin/orders/${order.id}`}>
                        Review →
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {!orders.length ? (
            <div className="admin-empty">
              <h3>No requests here yet</h3>
              <p>Change the status filter to see other requests.</p>
            </div>
          ) : null}
          <Pagination
            page={page}
            count={result.count ?? 0}
            href={`/admin/orders?${new URLSearchParams({ status })}`}
          />
        </Card>
      )}
    </>
  );
}
