'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveShippingArea } from '@/app/admin/actions';
import type { ShippingArea } from '@/lib/shipping';
export function ShippingEditor({ initial }: { initial?: ShippingArea }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [price, setPrice] = useState(initial ? String(initial.price) : '');
  const [active, setActive] = useState(initial?.is_active ?? true);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <form
      className="admin-panel admin-form-section"
      onSubmit={(event) => {
        event.preventDefault();
        setError('');
        startTransition(async () => {
          try {
            const result = await saveShippingArea({
              id: initial?.id ?? null,
              expected_updated_at: initial?.updated_at ?? null,
              name,
              price: Number(price),
              is_active: active,
            });
            if (result.error) setError(result.error);
            else {
              router.push('/admin/shipping?saved=1');
              router.refresh();
              if (!initial) {
                setName('');
                setPrice('');
                setActive(true);
              }
            }
          } catch {
            setError('The area could not be saved. Please try again.');
          }
        });
      }}
    >
      <h2>{initial ? 'Edit delivery area' : 'Add a delivery area'}</h2>
      <label>
        Area name
        <input
          required
          value={name}
          maxLength={160}
          placeholder="e.g. Imphal West"
          autoComplete="off"
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label>
        Delivery price (₹)
        <input
          required
          type="number"
          min="0"
          max="100000"
          step="0.01"
          aria-describedby="shipping-price-help"
          value={price}
          placeholder="e.g. 50"
          onChange={(event) => setPrice(event.target.value)}
        />
      </label>
      <small id="shipping-price-help">Use 0 for free delivery to this area.</small>
      <label className="admin-checkbox">
        <input
          type="checkbox"
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
        />
        Available at checkout
      </label>
      <p className="admin-help">
        Inactive areas are hidden from customers. Changes apply to future requests; past requests
        keep their saved delivery charge.
      </p>
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
      <button className="button button-dark" disabled={pending}>
        {pending ? 'Saving…' : 'Save delivery area'}
      </button>
      {initial ? (
        <Link className="text-link" href="/admin/shipping">
          Cancel edit
        </Link>
      ) : null}
    </form>
  );
}
