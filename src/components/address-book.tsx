'use client';
import { useState } from 'react';
import { MapPin, Plus, Pencil } from 'lucide-react';
import type { SavedAddress } from '@/lib/address';
import type { CustomerProfile } from '@/lib/profile-server';
import type { DeliveryArea } from '@/lib/shipping';
import { CheckoutAddressPicker } from './checkout-address-picker';
export function AddressBook({
  addresses,
  error,
  areas,
  profile,
}: {
  addresses: SavedAddress[];
  error: string | null;
  areas: DeliveryArea[];
  profile: CustomerProfile | null;
}) {
  const [editing, setEditing] = useState<SavedAddress | null | undefined>(undefined);
  const blank: SavedAddress = {
    name: profile?.name ?? '',
    phone: profile?.phone ?? '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    shipping_area_id: null,
  };
  return (
    <>
      <div className="section-heading">
        <h1>Saved addresses</h1>
        <button
          type="button"
          className="button button-outline"
          disabled={!!error}
          onClick={() => setEditing(null)}
        >
          <Plus size={16} /> Add new address
        </button>
      </div>
      {error ? (
        <p className="notice" role="status">
          {error}
        </p>
      ) : addresses.length ? (
        <div className="address-book-list">
          {addresses.map((address, index) => (
            <article className="account-panel address-book-card" key={address.id ?? index}>
              <MapPin size={20} aria-hidden="true" />
              <div className="saved-address-details">
                <strong>{address.name}</strong>
                <p>{address.phone}</p>
                <p>
                  {address.address}
                  <br />
                  {address.city}, {address.state} {address.pincode}
                </p>
                {areas.find((area) => area.id === address.shipping_area_id) ? (
                  <p>{areas.find((area) => area.id === address.shipping_area_id)!.name}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Edit address"
                onClick={() => setEditing(address)}
              >
                <Pencil size={17} aria-hidden="true" />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <MapPin size={32} />
          <h2>No saved addresses</h2>
        </div>
      )}
      {editing !== undefined ? (
        <CheckoutAddressPicker
          savedAddress={null}
          selectedAddress={editing ?? blank}
          areaId={
            areas.some((area) => area.id === editing?.shipping_area_id)
              ? editing!.shipping_area_id!
              : ''
          }
          areas={areas}
          canSave
          startEditing
          submitLabel="Save address"
          onClose={() => setEditing(undefined)}
          onSelect={() => {
            setEditing(undefined);
          }}
        />
      ) : null}
    </>
  );
}
