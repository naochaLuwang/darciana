import { paymentLabel } from '@/lib/payment';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AuthForm } from '@/components/auth-form';
import { signOut } from '@/app/auth/actions';
import { SignOutButton } from '@/components/sign-out-button';
import { money } from '@/lib/commerce';
import { getSavedAddress } from '@/lib/address-server';
import { CustomerProfile } from '@/components/customer-profile';
import { DeleteAccount } from '@/components/delete-account';
import { getCustomerProfile } from '@/lib/profile-server';
import { MapPin, ChevronRight, Package, UserRound, ArrowRight } from 'lucide-react';
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
              {params.error === 'oauth'
                ? 'Google sign-in wasn’t completed. Please try again.'
                : 'This link has expired. Sign in again.'}
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
  const name = personal.profile?.name.trim() ?? '';
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => Array.from(part)[0])
    .join('')
    .toUpperCase();
  return (
    <main id="main" className="page-width account-page">
      <header className="account-identity">
        <div className="account-avatar" aria-hidden="true">
          {initials || <UserRound size={28} strokeWidth={1.4} />}
        </div>
        <div className="account-identity-copy">
          <p className="account-kicker">Your profile</p>
          <h1>{name || 'My account'}</h1>
          <p className="account-email">{user.email}</p>
        </div>
      </header>
      <CustomerProfile
        key={user.id}
        profile={personal.profile}
        fallback={addressBook.address}
        error={personal.error}
      />
      <nav className="account-shortcuts" aria-label="Account shortcuts">
        <Link href="/account/addresses" className="account-menu-row">
          <span className="account-menu-icon" aria-hidden="true">
            <MapPin size={19} />
          </span>
          <span className="account-menu-label">Saved addresses</span>
          {addressBook.addresses.length ? (
            <span className="account-count">{addressBook.addresses.length}</span>
          ) : null}
          <ChevronRight size={17} aria-hidden="true" />
        </Link>
      </nav>
      <section
        className="account-orders"
        id="account-orders"
        aria-labelledby="account-orders-title"
      >
        <div className="account-section-heading">
          <Package size={18} aria-hidden="true" />
          <h2 id="account-orders-title">Orders</h2>
        </div>
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
                    <span className="little-label">
                      ORDER #{order.id.slice(0, 8).toUpperCase()}
                    </span>
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
          <div className="account-empty-orders">
            <h3>No orders yet</h3>
            <Link href="/shop" className="text-link">
              Shop products <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        )}
      </section>
      <div className="account-session">
        <form action={signOut}>
          <SignOutButton />
        </form>
        <DeleteAccount />
      </div>
    </main>
  );
}
