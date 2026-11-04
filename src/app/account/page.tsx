import { paymentLabel } from '@/lib/payment';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AuthForm } from '@/components/auth-form';
import { signOut } from '@/app/auth/actions';
import { money } from '@/lib/commerce';
import { getSavedAddress } from '@/lib/address-server';
import { CustomerProfile } from '@/components/customer-profile';
import { DeleteAccount } from '@/components/delete-account';
import { getCustomerProfile } from '@/lib/profile-server';
import { MapPin, ChevronRight } from 'lucide-react';
export const metadata = { title: 'Your account' };
export const dynamic = 'force-dynamic';
export default async function Account({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; confirmed?: string; error?: string; deleted?: string }>;
}) {
  const [supabase, params] = await Promise.all([createClient(), searchParams]);
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user)
    return (
      <main id="main" className="page-width auth-page">
        <div>
          {params.deleted ? (
            <p className="form-success" role="status">
              Account deleted.
            </p>
          ) : null}
          {params.error ? (
            <p role="alert" className="notice">
              This link has expired. Sign in again.
            </p>
          ) : null}
          <AuthForm next={params.next === 'checkout' ? 'checkout' : ''} />
        </div>
      </main>
    );
  const [result, addressBook, personal] = await Promise.all([
    supabase!
      .from('storefront_order_requests')
      .select(
        'id,items,item_total,shipping_area_name,shipping_price,order_total,status,created_at,shipping',
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
    getSavedAddress(supabase!, user.id),
    getCustomerProfile(supabase!, user.id),
  ]);
  type Order = {
    id: string;
    items: { name: string; option: string; quantity: number; unit_price: number }[];
    item_total: number;
    shipping_area_name: string | null;
    shipping_price: number | null;
    order_total: number | null;
    status: string;
    created_at: string;
    shipping: { payment_mode?: string };
  };
  const orders = (result.data ?? []) as Order[];
  return (
    <main id="main" className="page-width section-space">
      <div className="section-heading">
        <div>
          <h1>My account</h1>
          <p>{user.email}</p>
        </div>
        <form action={signOut}>
          <button className="button button-outline">Sign out</button>
        </form>
      </div>
      <CustomerProfile
        key={user.id}
        profile={personal.profile}
        fallback={addressBook.address}
        error={personal.error}
      />
      <Link href="/account/addresses" className="account-menu-row">
        <MapPin size={20} />
        <span>Saved addresses</span>
        <span className="muted">{addressBook.addresses.length || ''}</span>
        <ChevronRight size={18} />
      </Link>
      <h2 className="orders-heading">Orders</h2>
      {result.error ? (
        <div className="notice" role="status">
          Orders are unavailable. Try again later.
        </div>
      ) : orders.length ? (
        <div className="orders-list">
          {orders.map((order) => (
            <article key={order.id} className="order-card">
              <div className="order-card-heading">
                <div>
                  <span className="little-label">ORDER #{order.id.slice(0, 8).toUpperCase()}</span>
                  <p>
                    {new Date(order.created_at).toLocaleDateString('en-IN', {
                      dateStyle: 'medium',
                      timeZone: 'Asia/Kolkata',
                    })}
                  </p>
                </div>
                <span className="order-status">
                  {order.status === 'awaiting_confirmation'
                    ? 'Pending confirmation'
                    : order.status.replaceAll('_', ' ')}
                </span>
              </div>
              {order.items.map((item, index) => (
                <div className="order-line" key={index}>
                  <span>
                    {item.name} {item.option !== 'Standard' ? `· ${item.option}` : ''} ×{' '}
                    {item.quantity}
                  </span>
                  <span>{money(item.unit_price * item.quantity)}</span>
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
              <div className="order-total">
                <strong>{order.order_total == null ? 'Item total' : 'Order total'}</strong>
                <strong>{money(order.order_total ?? order.item_total)}</strong>
              </div>
              {order.shipping?.payment_mode === 'cash_on_delivery' ||
              order.shipping?.payment_mode === 'manual_upi' ? (
                <div className="order-shipping-breakdown">
                  <span>Payment mode</span>
                  <span>{paymentLabel(order.shipping.payment_mode)}</span>
                </div>
              ) : null}
              {order.order_total == null ? (
                <p className="tax-note">Delivery charge to be confirmed.</p>
              ) : order.shipping?.payment_mode === 'manual_upi' ? (
                <p className="tax-note">Contact the store for UPI payment details.</p>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>No orders yet</h2>
          <Link href="/shop" className="button button-dark">
            Shop products →
          </Link>
        </div>
      )}
      <DeleteAccount />
    </main>
  );
}
