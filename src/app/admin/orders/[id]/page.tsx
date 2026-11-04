import { paymentLabel } from '@/lib/payment';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { adminSession, type AdminOrder } from '@/lib/admin';
import { money } from '@/lib/commerce';
import { AdminHeading, AdminNotice, adminDate } from '@/components/admin/common';
import { OrderStatus } from '@/components/admin/order-status';
export const metadata = { title: 'Review request' };
export default async function ReviewOrder({ params }: { params: Promise<{ id: string }> }) {
  const session = await adminSession();
  if (!session) return null;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const result = await session.db
    .from('storefront_order_requests')
    .select(
      'id,user_id,created_at,status,item_total,shipping_area_name,shipping_price,order_total,shipping,items',
    )
    .eq('id', id)
    .maybeSingle();
  if (result.error)
    return <AdminNotice>The request could not load. Refresh and try again.</AdminNotice>;
  if (!result.data) notFound();
  const order = result.data as AdminOrder;
  return (
    <>
      <AdminHeading
        title={`Request #${order.id.slice(0, 8).toUpperCase()}`}
        description={`Received ${adminDate(order.created_at)} IST`}
        action={
          <Link href="/admin/orders" className="button button-outline">
            Back to requests
          </Link>
        }
      />
      <div className="admin-editor">
        <div className="admin-editor-main">
          <section className="admin-panel admin-form-section">
            <div className="admin-panel-heading">
              <h2>Requested items</h2>
              <span className={`admin-status ${order.status}`}>
                {order.status.replaceAll('_', ' ')}
              </span>
            </div>
            {order.items.map((item, index) => (
              <div key={index} className="admin-order-item">
                <div>
                  <strong>{item.name}</strong>
                  <span>
                    {item.option} · Qty {item.quantity} · {money(item.unit_price)} each
                  </span>
                </div>
                <strong>{money(item.quantity * item.unit_price)}</strong>
              </div>
            ))}
            <div className="order-shipping-breakdown">
              <span>Items</span>
              <span>{money(order.item_total)}</span>
            </div>
            <div className="order-shipping-breakdown">
              <span>
                Delivery{order.shipping_area_name ? ` · ${order.shipping_area_name}` : ''}
              </span>
              <span>
                {order.shipping_price == null
                  ? 'Not yet priced'
                  : order.shipping_price === 0
                    ? 'Free'
                    : money(order.shipping_price)}
              </span>
            </div>
            <div className="admin-order-total">
              <strong>{order.order_total == null ? 'Item total' : 'Order total'}</strong>
              <strong>{money(order.order_total ?? order.item_total)}</strong>
            </div>
            <div className="order-shipping-breakdown">
              <span>Payment mode</span>
              <strong>{paymentLabel(order.shipping.payment_mode)}</strong>
            </div>
            <p className="admin-help">
              {order.order_total == null
                ? 'This earlier request has no saved delivery charge. Confirm delivery separately with the customer.'
                : order.shipping.payment_mode === 'manual_upi'
                  ? 'Manual UPI selected. Share payment details after confirming the request; payment has not been verified by the app.'
                  : order.shipping.payment_mode === 'cash_on_delivery'
                    ? 'Cash on delivery. Review stock and confirm this request before fulfilment.'
                    : 'These item and delivery prices were saved when the customer submitted the request. Payment is arranged separately.'}
            </p>
          </section>
          <section className="admin-panel admin-form-section">
            <h2>Delivery details</h2>
            <address className="admin-address">
              <strong>{order.shipping.name}</strong>
              {order.shipping_area_name ? (
                <span>Delivery area: {order.shipping_area_name}</span>
              ) : null}
              <span>{order.shipping.address}</span>
              <span>
                {order.shipping.city}, {order.shipping.state} {order.shipping.pincode}
              </span>
              <a href={`tel:${order.shipping.phone.replace(/[^+0-9]/g, '')}`}>
                {order.shipping.phone}
              </a>
            </address>
            {order.shipping.notes ? (
              <div className="admin-customer-note">
                <h3>Customer note</h3>
                <p>{order.shipping.notes}</p>
              </div>
            ) : null}
          </section>
        </div>
        <aside className="admin-panel admin-form-section">
          <h2>Manage request</h2>
          <OrderStatus key={order.status} id={order.id} status={order.status} />
        </aside>
      </div>
    </>
  );
}
