'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AdminField, AdminSwitch, FormReady } from './form-controls';
import { Card } from '@/components/ui/card';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveShippingArea } from '@/app/admin/actions';
import type { ShippingArea } from '@/lib/shipping';
import { roundRupees } from '@/lib/money';
export function ShippingEditor({ initial }: { initial?: ShippingArea }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [price, setPrice] = useState(initial ? String(roundRupees(initial.price)) : '');
  const [active, setActive] = useState(initial?.is_active ?? true);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Card className="gap-0 py-0">
      <form
        className="admin-form-card p-5 sm:p-6"
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
        <FormReady>
          <h2>{initial ? 'Edit delivery area' : 'Add a delivery area'}</h2>
          <AdminField label="Area name">
            <Input
              required
              value={name}
              maxLength={160}
              placeholder="e.g. Imphal West"
              autoComplete="off"
              onChange={(event) => setName(event.target.value)}
            />
          </AdminField>
          <AdminField label="Delivery price (₹)">
            <Input
              required
              type="number"
              min="0"
              max="100000"
              step="1"
              aria-describedby="shipping-price-help"
              value={price}
              placeholder="e.g. 50"
              onChange={(event) => setPrice(event.target.value)}
              onBlur={(event) => {
                if (event.currentTarget.value !== '')
                  setPrice(String(roundRupees(Number(event.currentTarget.value))));
              }}
            />
          </AdminField>
          <small id="shipping-price-help">Use 0 for free delivery to this area.</small>
          <AdminSwitch
            checked={active}
            onCheckedChange={(checked) => setActive(checked === true)}
            label={<>Available at checkout</>}
          />
          <p className="admin-help">
            Inactive areas are hidden from customers. Changes apply to future requests; past
            requests keep their saved delivery charge.
          </p>
          {error ? (
            <p role="alert" className="form-error">
              {error}
            </p>
          ) : null}
          <Button disabled={pending}>{pending ? 'Saving…' : 'Save delivery area'}</Button>
          {initial ? (
            <Link className="text-link" href="/admin/shipping">
              Cancel edit
            </Link>
          ) : null}
        </FormReady>
      </form>
    </Card>
  );
}
