import Link from 'next/link';
import { ArrowRight, Plus, Package, Boxes, ClipboardList, IndianRupee } from 'lucide-react';
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
          icon: Package,
          href: '/admin/products?status=active',
        },
        {
          label: 'Low stock options',
          value: data.low_stock,
          note: '5 units or fewer · active products',
          icon: Boxes,
          href: '/admin/inventory?low=true',
        },
        {
          label: 'Awaiting confirmation',
          value: data.pending_requests,
          note: 'Requests needing your attention',
          icon: ClipboardList,
          href: '/admin/orders?status=awaiting_confirmation',
        },
        {
          label: 'Requested item value',
          value: money(data.requested_value),
          note: 'Last 30 days · excludes cancelled',
          icon: IndianRupee,
          href: '/admin/orders',
        },
      ]
    : [];
  return (
    <>
      <AdminHeading
        title="Your store at a glance"
        description="A clear view of your catalog and the requests that need you."
        action={
          <Link href="/admin/products/new" className="button button-dark">
            <Plus size={17} /> Add product
          </Link>
        }
      />
      {summary.error ? (
        <AdminNotice>
          Overview data could not load. Check the database setup and refresh.
        </AdminNotice>
      ) : (
        <div className="admin-stat-grid">
          {cards.map(({ label, value, note, icon: Icon, href }) => (
            <Link href={href} className="admin-stat" key={label}>
              <span className="admin-stat-icon">
                <Icon size={20} strokeWidth={1.5} />
              </span>
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
              View all <ArrowRight size={15} />
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
                  <span className="admin-order-initial">{order.shipping.name.slice(0, 1)}</span>
                  <div>
                    <strong>{order.shipping.name}</strong>
                    <span>
                      #{order.id.slice(0, 8).toUpperCase()} · {adminDate(order.created_at)}
                    </span>
                  </div>
                  <div>
                    <strong>{money(order.order_total ?? order.item_total)}</strong>
                    <span className="admin-status">{order.status.replaceAll('_', ' ')}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="admin-empty">
              <ClipboardList size={28} />
              <h3>No requests yet</h3>
              <p>Customer requests will appear here when they arrive.</p>
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
              <h3>A fresh start</h3>
              <p>Catalog changes and request updates are recorded here.</p>
            </div>
          )}
        </section>
      </div>
      <div className="admin-information">
        Requested item value excludes delivery and is not collected revenue. Delivery is set by area
        at checkout; payment and stock reservation are handled separately.
      </div>
    </>
  );
}
