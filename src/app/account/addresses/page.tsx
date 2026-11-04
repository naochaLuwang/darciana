import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getSavedAddress } from '@/lib/address-server';
import { getCustomerProfile } from '@/lib/profile-server';
import { getDeliveryAreas } from '@/lib/shipping-server';
import { AddressBook } from '@/components/address-book';
export const metadata = { title: 'Saved addresses' };
export default async function AddressesPage() {
  const db = await createClient();
  const user = db ? (await db.auth.getUser()).data.user : null;
  if (!user)
    return (
      <main id="main" className="page-width empty-state">
        <h1>Sign in to manage addresses</h1>
        <Link className="button button-dark" href="/account">
          Sign in
        </Link>
      </main>
    );
  const [book, profile, delivery] = await Promise.all([
    getSavedAddress(db!, user.id),
    getCustomerProfile(db!, user.id),
    getDeliveryAreas(),
  ]);
  return (
    <main id="main" className="page-width section-space account-addresses-page">
      <Link className="text-link" href="/account">
        ← Back to account
      </Link>
      <AddressBook
        key={user.id}
        addresses={book.addresses}
        error={book.bookError}
        areas={delivery.areas}
        profile={profile.profile}
      />
    </main>
  );
}
