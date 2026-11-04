'use client';
import { useState, useTransition } from 'react';
import { MapPin, Pencil } from 'lucide-react';
import { saveAddress } from '@/app/account/actions';
import { addressFromForm, type SavedAddress } from '@/lib/address';
import type { DeliveryArea } from '@/lib/shipping';
import { AddressFields } from './address-fields';
import { DeliveryAreaSelect } from './delivery-area-select';

export function ProfileAddress({
  address,
  error,
  areas,
  areasError,
}: {
  address: SavedAddress | null;
  error: string | null;
  areas: DeliveryArea[];
  areasError: string | null;
}) {
  const [editing, setEditing] = useState(!address);
  const saved = address;
  const [areaId, setAreaId] = useState(
    areas.some((a) => a.id === address?.shipping_area_id) ? address!.shipping_area_id! : '',
  );
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const selectedArea = areas.find((a) => a.id === saved?.shipping_area_id);
  return (
    <section className="profile-address" aria-labelledby="profile-address-heading">
      <div className="profile-address-heading">
        <div className="profile-address-title">
          <MapPin size={22} strokeWidth={1.5} aria-hidden="true" />
          <div>
            <h2 id="profile-address-heading">Delivery address</h2>
          </div>
        </div>
        {saved && !editing ? (
          <button
            type="button"
            className="text-link"
            onClick={() => {
              setEditing(true);
              setMessage('');
              setAreaId(
                areas.some((area) => area.id === saved.shipping_area_id)
                  ? saved.shipping_area_id!
                  : '',
              );
            }}
          >
            <Pencil size={14} /> Edit address
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="notice" role="status">
          {error}
        </p>
      ) : null}
      {!error && saved && !editing ? (
        <div className="saved-address-details">
          <strong>{saved.name}</strong>
          <p>{saved.phone}</p>
          <p>
            {saved.address}
            <br />
            {saved.city}, {saved.state} · {saved.pincode}
          </p>
          {selectedArea ? (
            <p className="saved-address-area">Delivery area · {selectedArea.name}</p>
          ) : saved.shipping_area_id ? (
            <p className="muted">Select a new delivery area at checkout.</p>
          ) : null}
        </div>
      ) : null}
      {!error && editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const input = addressFromForm(new FormData(event.currentTarget), areaId);
            setSaveError('');
            setMessage('');
            startTransition(async () => {
              try {
                const result = await saveAddress(input);
                if (result.error) {
                  setSaveError(result.error);
                  return;
                }
                setEditing(false);
                setMessage('Address saved.');
              } catch {
                setSaveError(
                  'Your address could not be saved. Check your connection and try again.',
                );
              }
            });
          }}
        >
          <fieldset className="address-fieldset" disabled={pending}>
            <legend className="sr-only">Contact and delivery address</legend>
            <div className="form-grid">
              <AddressFields address={saved} />
              <div className="wide">
                {areasError ? (
                  <p className="muted">Select a delivery area at checkout.</p>
                ) : areas.length ? (
                  <DeliveryAreaSelect
                    areas={areas}
                    value={areaId}
                    onChange={setAreaId}
                    disabled={pending}
                    required={false}
                  />
                ) : null}
              </div>
            </div>
            {saveError ? (
              <p className="form-error" role="alert">
                {saveError}
              </p>
            ) : null}
            <div className="address-actions">
              <button type="submit" className="button button-dark" disabled={pending}>
                {pending ? 'Saving address…' : 'Save address'}
              </button>
              {saved ? (
                <button
                  type="button"
                  className="button button-outline"
                  disabled={pending}
                  onClick={() => {
                    setEditing(false);
                    setSaveError('');
                    setAreaId(
                      areas.some((a) => a.id === saved.shipping_area_id)
                        ? saved.shipping_area_id!
                        : '',
                    );
                  }}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </fieldset>
        </form>
      ) : null}
      {message ? (
        <p className="form-success" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
