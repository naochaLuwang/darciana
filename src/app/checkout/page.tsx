import Link from 'next/link';
import { ArrowLeft, ArrowRight, ShoppingBag, UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { CheckoutForm } from '@/components/checkout-form';
import { getDeliveryAreas } from '@/lib/shipping-server';
import { getSavedAddress } from '@/lib/address-server';
import { getCustomerProfile } from '@/lib/profile-server';
export const metadata = { title: 'Checkout' };
export const dynamic = 'force-dynamic';
export default async function CheckoutPage() {
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user)
    return (
      <main id="main" className="page-width checkout-signin-page">
        <div className="checkout-signin-card">
          <div className="checkout-signin-art" aria-hidden="true">
            <ShoppingBag size={42} strokeWidth={1.35} />
            <span>
              <UserRound size={17} strokeWidth={1.7} />
            </span>
          </div>
          <h1>Sign in to checkout</h1>
          <p>Your items stay in your bag.</p>
          <div className="checkout-signin-actions">
            <Link className="button button-dark" href="/account?next=checkout">
              Sign in <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link className="button checkout-signin-back" href="/bag">
              <ArrowLeft size={17} aria-hidden="true" /> Back to bag
            </Link>
          </div>
        </div>
      </main>
    );
  const [delivery, profile, personal] = await Promise.all([
    getDeliveryAreas(),
    getSavedAddress(supabase!, user.id),
    getCustomerProfile(supabase!, user.id),
  ]);
  return (
    <main id="main" className="page-width checkout-page">
      <h1 className="sr-only">Checkout</h1>
      <CheckoutForm
        key={user.id}
        areas={delivery.areas}
        areasError={delivery.error}
        savedAddress={profile.address}
        savedAddresses={profile.addresses}
        contact={personal.profile}
        addressError={profile.error}
      />
    </main>
  );
}
