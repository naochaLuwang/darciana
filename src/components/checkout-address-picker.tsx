'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Check, MapPin, Plus, X } from 'lucide-react';
import { saveAddress } from '@/app/account/actions';
import { addressFromForm, type SavedAddress } from '@/lib/address';
import { addressSchema } from '@/lib/checkout';
import { AddressFields } from './address-fields';
import { DeliveryAreaSelect } from './delivery-area-select';
import type { DeliveryArea } from '@/lib/shipping';

export function CheckoutAddressPicker({
  savedAddress,
  selectedAddress,
  areaId: initialAreaId,
  areas,
  savedAddresses,
  startEditing = false,
  defaultContact,
  submitLabel = 'Use this address',
  canSave,
  onSelect,
  onClose,
}: {
  savedAddress: SavedAddress | null;
  selectedAddress: SavedAddress | null;
  areaId: string;
  areas?: DeliveryArea[];
  savedAddresses?: SavedAddress[];
  startEditing?: boolean;
  defaultContact?: { name: string; phone: string } | null;
  submitLabel?: string;
  canSave: boolean;
  onSelect: (address: SavedAddress) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState(startEditing || (!savedAddress && !selectedAddress));
  const emptyDraft: SavedAddress | null = defaultContact
    ? { ...defaultContact, address: '', city: '', state: '', pincode: '', shipping_area_id: null }
    : null;
  const [draft, setDraft] = useState(selectedAddress ?? savedAddress ?? emptyDraft);
  const [areaId, setAreaId] = useState(initialAreaId);
  const choices = savedAddresses?.length
    ? savedAddresses
    : savedAddress
      ? [savedAddress]
      : selectedAddress
        ? [selectedAddress]
        : [];
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const sheet = dialog.current!;
    sheet.showModal();
    return () => sheet.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="checkout-sheet"
      aria-labelledby="address-picker-title"
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
      onClose={() => {
        if (!dialog.current?.open) onClose();
      }}
    >
      <div className="checkout-sheet-heading">
        <h2 id="address-picker-title">
          {editing ? 'Delivery address' : 'Select delivery address'}
        </h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close address selector"
          disabled={pending}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const parsed = addressSchema.safeParse(addressFromForm(form, areaId));
            setError('');
            if (!parsed.success) {
              setError(parsed.error.issues[0].message);
              return;
            }
            startTransition(async () => {
              try {
                let selectedId = draft?.id;
                if (canSave) {
                  const result = await saveAddress({ ...parsed.data, id: draft?.id });
                  if (result.error) {
                    setError(result.error);
                    return;
                  }
                  selectedId = result.id ?? selectedId;
                }
                onSelect({ ...parsed.data, id: selectedId });
              } catch {
                setError('Could not save address. Please try again.');
              }
            });
          }}
        >
          <fieldset className="address-fieldset" disabled={pending}>
            <div className="form-grid">
              <AddressFields address={draft} />
              {areas?.length ? (
                <div className="wide">
                  <DeliveryAreaSelect
                    areas={areas}
                    value={areaId}
                    onChange={setAreaId}
                    disabled={pending}
                    required={false}
                  />
                </div>
              ) : null}
            </div>
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="address-actions">
              <button type="submit" className="button button-dark" disabled={pending}>
                {pending ? 'Saving…' : submitLabel}
              </button>
              {!startEditing && (savedAddress || selectedAddress) ? (
                <button
                  type="button"
                  className="button button-outline"
                  disabled={pending}
                  onClick={() => {
                    setEditing(false);
                    setError('');
                  }}
                >
                  Back
                </button>
              ) : null}
            </div>
          </fieldset>
        </form>
      ) : (
        <div className="checkout-address-options">
          {choices.map((choice, index) => (
            <button
              key={choice.id ?? index}
              type="button"
              className="checkout-address-option"
              onClick={() => onSelect(choice)}
            >
              <MapPin size={19} />
              <span>
                <strong>{choice.name}</strong>
                <span>{choice.address}</span>
                <span>
                  {choice.city}, {choice.state} · {choice.pincode}
                </span>
                <span>{choice.phone}</span>
              </span>
              <Check size={18} />
            </button>
          ))}
          <div className="address-actions">
            <button
              type="button"
              className="button button-outline"
              onClick={() => {
                setDraft(emptyDraft);
                setEditing(true);
              }}
            >
              <Plus size={16} /> Add new address
            </button>
            {selectedAddress || savedAddress ? (
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  setDraft(selectedAddress ?? savedAddress);
                  setEditing(true);
                }}
              >
                Edit address
              </button>
            ) : null}
          </div>
        </div>
      )}
    </dialog>
  );
}
