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
        description="Orders, stock and recent store activity"
        action={
          <Link href="/admin/products/new" className="button button-dark">
            <Plus size={18} strokeWidth={1.5} aria-hidden="true" /> Add product
          </Link>
        }
      />
      {summary.error ? (
        <AdminNotice>
          Overview data could not load. Check the database setup and refresh.
        </AdminNotice>
      ) : (
        <div className="admin-stat-grid">
          {cards.map(({ label, value, note, attention, href }) => (
            <Link
              href={href}
              className={`admin-stat${attention ? ' admin-stat-attention' : ''}`}
              key={label}
            >
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{note}</small>
            </Link>
          ))}
        </div>
      )}
      <div className="admin-overview-grid">
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Recent order requests</h2>
            <Link href="/admin/orders" className="text-link">
              View all <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </div>
          {recent.error ? (
            <AdminNotice>
              Order requests could not load. Run the order-request setup if it is still pending.
            </AdminNotice>
          ) : recent.data?.length ? (
            <div className="admin-recent-orders">
              {(recent.data as AdminOrder[]).map((order) => (
                <Link key={order.id} href={`/admin/orders/${order.id}`}>
                  <span className="admin-order-initial" aria-hidden="true">
                    {order.shipping.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="admin-order-summary">
                    <strong>{order.shipping.name}</strong>
                    <div className="admin-order-meta">
                      <span className="admin-order-reference">
                        #{order.id.slice(0, 8).toUpperCase()}
                      </span>
                      <time dateTime={order.created_at}>{adminDate(order.created_at)}</time>
                    </div>
                  </div>
                  <div>
                    <strong>{money(order.order_total ?? order.item_total)}</strong>
                    <span className={`admin-status ${order.status}`}>
                      {order.status.replaceAll('_', ' ')}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="admin-empty">
              <ClipboardList size={24} strokeWidth={1.5} aria-hidden="true" />
              <h3>No requests yet</h3>
              <p>New customer orders will appear here</p>
            </div>
          )}
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Recent activity</h2>
          </div>
          {activity.error ? (
            <AdminNotice>Activity could not load.</AdminNotice>
          ) : activity.data?.length ? (
            <ul className="admin-activity">
              {activity.data.map((entry) => (
                <li key={entry.id}>
                  <span />
                  <div>
                    <strong>{entry.action.replaceAll('_', ' ')}</strong>
                    <p>{entry.label}</p>
                    <small>{adminDate(entry.created_at)}</small>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="admin-empty">
              <h3>No recent activity</h3>
              <p>Catalog and order updates will appear here</p>
            </div>
          )}
        </section>
      </div>
      <div className="admin-information">
        Item value excludes delivery and is not collected revenue. Delivery prices are set by area;
        payment and stock reservation are handled separately.
      </div>
    </>
  );
}
