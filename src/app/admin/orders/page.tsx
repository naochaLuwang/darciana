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
        description="Review delivery details and move requests through confirmation and fulfilment."
      />
      <form className="admin-filterbar">
        <select name="status" aria-label="Request status" defaultValue={status}>
          <option value="">All statuses</option>
          <option value="awaiting_confirmation">Awaiting confirmation</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button className="button button-outline">Apply filter</button>
      </form>
      {result.error ? (
        <AdminNotice>
          Requests could not load. Run supabase/setup.sql if the order-request setup is still
          pending.
        </AdminNotice>
      ) : (
        <section className="admin-panel admin-table-panel">
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Received (IST)</th>
                  <th>
                    <span className="sr-only">View request</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link href={`/admin/orders/${order.id}`}>
                        <strong>#{order.id.slice(0, 8).toUpperCase()}</strong>
                        <small>
                          {order.items.reduce((sum, item) => sum + item.quantity, 0)} items
                        </small>
                      </Link>
                    </td>
                    <td>
                      <strong>{order.shipping.name}</strong>
                      <small>{order.shipping.city}</small>
                    </td>
                    <td>
                      <span className={`admin-status ${order.status}`}>
                        {order.status.replaceAll('_', ' ')}
                      </span>
                    </td>
                    <td>
                      {money(order.order_total ?? order.item_total)}
                      <small>
                        {order.order_total == null
                          ? 'Delivery not yet priced'
                          : `Includes ${order.shipping_price === 0 ? 'free delivery' : `${money(order.shipping_price ?? 0)} delivery`}`}
                      </small>
                    </td>
                    <td>{adminDate(order.created_at)}</td>
                    <td>
                      <Link className="text-link" href={`/admin/orders/${order.id}`}>
                        Review →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
        </section>
      )}
    </>
  );
}
