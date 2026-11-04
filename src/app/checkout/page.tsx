import Link from 'next/link';
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
      <main id="main" className="page-width empty-state">
        <h1>Sign in to checkout</h1>
        <Link className="button button-dark" href="/account?next=checkout">
          Sign in →
        </Link>
        <Link className="text-link" href="/bag">
          Back to bag
        </Link>
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
