'use client';
import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowRight, Banknote, CheckCircle2, ChevronRight, MapPin } from 'lucide-react';
import { paymentOptions, paymentLabel, type PaymentMode } from '@/lib/payment';
import { useShop } from './shop-provider';
import { money } from '@/lib/commerce';
import { submitCheckout } from '@/app/checkout/actions';
import { DeliveryAreaSelect } from './delivery-area-select';
import { totalWithShipping, type DeliveryArea } from '@/lib/shipping';
import type { SavedAddress } from '@/lib/address';
import { addressSchema } from '@/lib/checkout';
import { CheckoutAddressPicker } from './checkout-address-picker';
import { CheckoutTerms } from './checkout-terms';

export function CheckoutForm({
  areas,
  areasError,
  savedAddress,
  savedAddresses,
  contact,
  addressError,
}: {
  areas: DeliveryArea[];
  areasError: string | null;
  savedAddress: SavedAddress | null;
  savedAddresses: SavedAddress[];
  contact: { name: string; phone: string } | null;
  addressError: string | null;
}) {
  const { lines, items, total, count, clear } = useShop();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [attempted, setAttempted] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const [address, setAddress] = useState(savedAddress);
  const [addressOpen, setAddressOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash_on_delivery');
  const [areaId, setAreaId] = useState(
    areas.some((area) => area.id === savedAddress?.shipping_area_id)
      ? savedAddress!.shipping_area_id!
      : '',
  );
  const selectedArea = areas.find((area) => area.id === areaId);
  const grandTotal = selectedArea ? totalWithShipping(total, selectedArea.price) : null;
  const [success, setSuccess] = useState<{
    orderId: string;
    total: number;
    paymentMode: PaymentMode;
  } | null>(null);
  const requestId = useRef<string | null>(null);
  if (success)
    return (
      <div className="empty-state checkout-success">
        <CheckCircle2 size={44} strokeWidth={1.3} />
        <h2>Order received</h2>
        <p>
          #{success.orderId.slice(0, 8).toUpperCase()} · Total {money(success.total)}
        </p>
        <p>{paymentLabel(success.paymentMode)}</p>
        <p>Awaiting store confirmation.</p>
        {success.paymentMode === 'manual_upi' ? (
          <p>The store will share UPI payment details after confirmation.</p>
        ) : null}
        <Link className="button button-dark" href="/account">
          View orders <ArrowRight size={17} />
        </Link>
      </div>
    );
  if (!lines.length)
    return (
      <div className="empty-state">
        <h2>Your bag is empty.</h2>
        <Link href="/shop" className="button button-dark">
          Shop now <ArrowRight size={17} />
        </Link>
      </div>
    );
  const invalid =
    lines.length !== items.length || lines.some((line) => line.quantity > line.variant.stock);
  const hasDeliveryAddress = addressSchema.safeParse(address).success;
  const addressInvalid = attempted && !hasDeliveryAddress;
  const areaInvalid = attempted && !selectedArea;
  const termsInvalid = attempted && !termsAccepted;
  const ready =
    hasDeliveryAddress &&
    !!selectedArea &&
    !!paymentMode &&
    termsAccepted &&
    !areasError &&
    !invalid;
  function handleSubmit() {
    if (pending) return;
    setAttempted(true);
    setError('');
    if (!ready || !address || !selectedArea || grandTotal === null || !paymentMode) {
      const selector = !hasDeliveryAddress
        ? '.checkout-location'
        : !selectedArea
          ? '[role="combobox"]'
          : !termsAccepted
            ? '#checkout-accept-terms'
            : null;
      const target = selector ? form.current?.querySelector<HTMLElement>(selector) : null;
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({
        block: 'center',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      });
      return;
    }
    requestId.current ??= crypto.randomUUID();
    startTransition(async () => {
      try {
        const result = await submitCheckout({
          requestId: requestId.current,
          items,
          expectedTotal: grandTotal,
          shippingAreaId: selectedArea.id,
          expectedShippingPrice: selectedArea.price,
          shipping: { ...address, notes: '' },
          paymentMode,
          termsAccepted,
        });
        if (result.error) setError(result.error);
        else if (result.orderId) {
          setSuccess({
            orderId: result.orderId,
            total: result.total ?? grandTotal,
            paymentMode: result.paymentMode ?? paymentMode,
          });
          clear();
        }
      } catch {
        setError('Could not confirm your order. Please try again.');
      }
    });
  }
  return (
    <>
      <form
        ref={form}
        className="compact-checkout"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <section className="checkout-panel checkout-shipping" aria-labelledby="shipping-info-title">
          <h2 id="shipping-info-title">Shipping info</h2>
          <button
            type="button"
            className="checkout-location"
            aria-label="Select delivery address"
            aria-haspopup="dialog"
            data-invalid={addressInvalid || undefined}
            aria-describedby={addressInvalid ? 'checkout-address-error' : undefined}
            disabled={pending}
            onClick={() => setAddressOpen(true)}
          >
            <span className="checkout-location-icon">
              <MapPin size={21} strokeWidth={1.6} />
            </span>
            <span className="checkout-location-copy">
              <strong>Delivery location</strong>
              {address ? (
                <>
                  <span>
                    {address.name} · {address.phone}
                  </span>
                  <span>
                    {address.address}, {address.city}, {address.state} {address.pincode}
                  </span>
                </>
              ) : (
                <span>Select a delivery address</span>
              )}
            </span>
            <ChevronRight size={18} />
          </button>
          {addressInvalid ? (
            <p id="checkout-address-error" className="form-error checkout-field-error" role="alert">
              Select a delivery location.
            </p>
          ) : null}
          {areasError ? (
            <p role="alert" className="form-error">
              {areasError}
            </p>
          ) : areas.length ? (
            <div className="checkout-area">
              <DeliveryAreaSelect
                label="Shipping area"
                showHelp={false}
                areas={areas}
                value={areaId}
                onChange={setAreaId}
                disabled={pending}
                error={areaInvalid ? 'Select a shipping area.' : undefined}
              />
            </div>
          ) : (
            <p role="status" className="form-error">
              No delivery areas available.
            </p>
          )}
          {!!address?.shipping_area_id &&
          !areas.some((area) => area.id === address.shipping_area_id) &&
          !selectedArea ? (
            <p role="status" className="form-error">
              Select an available shipping area.
            </p>
          ) : null}
        </section>
        <section className="checkout-panel checkout-prices" aria-labelledby="price-details-title">
          <h2 id="price-details-title">Price details</h2>
          <div>
            <span>Items ({count})</span>
            <span>{money(total)}</span>
          </div>
          <div className="checkout-delivery-line">
            <span>Delivery</span>
            <span>
              {selectedArea ? (selectedArea.price === 0 ? 'Free' : money(selectedArea.price)) : '—'}
            </span>
          </div>
          <div className="summary-total">
            <strong>Total</strong>
            <strong>{grandTotal === null ? '—' : money(grandTotal)}</strong>
          </div>
        </section>
        <section className="checkout-panel checkout-payment" aria-labelledby="payment-mode-title">
          <h2 id="payment-mode-title">Select payment mode</h2>
          <div
            className="checkout-payment-options"
            role="radiogroup"
            aria-labelledby="payment-mode-title"
          >
            {paymentOptions.map((option) => (
              <label className="checkout-payment-option" key={option.value}>
                <input
                  type="radio"
                  aria-label={option.label}
                  aria-describedby={option.description ? `payment-help-${option.value}` : undefined}
                  name="payment_mode"
                  value={option.value}
                  checked={paymentMode === option.value}
                  onChange={() => setPaymentMode(option.value)}
                  required
                  disabled={pending}
                />
                <Banknote size={20} strokeWidth={1.6} aria-hidden="true" />
                <span className="checkout-payment-copy">
                  <strong>{option.label}</strong>
                  {option.description ? (
                    <small id={`payment-help-${option.value}`}>{option.description}</small>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
        </section>
        {invalid ? (
          <p className="form-error" role="alert">
            Some items are unavailable. <Link href="/bag">Review bag</Link>
          </p>
        ) : null}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="checkout-terms-control" data-invalid={termsInvalid || undefined}>
          <input
            id="checkout-accept-terms"
            aria-label="I accept the terms and conditions"
            type="checkbox"
            checked={termsAccepted}
            aria-invalid={termsInvalid || undefined}
            aria-describedby={termsInvalid ? 'checkout-terms-error' : undefined}
            onChange={(event) => setTermsAccepted(event.target.checked)}
            required
            disabled={pending}
          />
          <span>
            <label htmlFor="checkout-accept-terms">I accept the </label>
            <button type="button" className="text-link" onClick={() => setTermsOpen(true)}>
              Terms and conditions
            </button>
          </span>
        </div>
        {termsInvalid ? (
          <p id="checkout-terms-error" className="form-error checkout-field-error" role="alert">
            Accept the terms and conditions.
          </p>
        ) : null}
        <button
          type="submit"
          className="button button-dark checkout-confirm"
          disabled={pending || invalid || !!areasError || !areas.length}
        >
          {pending ? 'Confirming…' : 'Confirm and order'}
          <ArrowRight size={17} />
        </button>
      </form>
      {addressOpen ? (
        <CheckoutAddressPicker
          savedAddress={savedAddress}
          savedAddresses={savedAddresses}
          defaultContact={contact}
          selectedAddress={address}
          areaId={selectedArea?.id ?? ''}
          canSave={!addressError}
          onClose={() => setAddressOpen(false)}
          onSelect={(next) => {
            setAddress(next);
            if (!selectedArea && areas.some((area) => area.id === next.shipping_area_id))
              setAreaId(next.shipping_area_id!);
            setAddressOpen(false);
          }}
        />
      ) : null}
      {termsOpen ? <CheckoutTerms onClose={() => setTermsOpen(false)} /> : null}
    </>
  );
}
