'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { savePrices } from '@/app/admin/prices/actions';
import { discountedPrice } from '@/lib/commerce';
import { money, roundRupees } from '@/lib/money';
import type { ProductPricing, PriceOption } from '@/lib/product-pricing';
import { ProductImage } from '@/components/product-card';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldError } from '@/components/ui/field';
import { AdminField, AdminSelect, FormReady } from './form-controls';
import { StatusBadge } from './common';

type DraftPrice = Omit<PriceOption, 'price' | 'discount_value'> & {
  price: string;
  discount_value: string;
};
const discountOptions = [
  { value: 'none', label: 'No discount' },
  { value: 'amount', label: 'Amount off (₹)' },
  { value: 'percentage', label: 'Percentage off (%)' },
];
function drafts(product: ProductPricing): DraftPrice[] {
  return product.options.map((option) => ({
    ...option,
    price: String(option.price),
    discount_value: option.discount_type === 'none' ? '' : String(option.discount_value),
  }));
}
export function PriceEditor({ initial }: { initial: ProductPricing }) {
  const [saved, setSaved] = useState(initial);
  const [options, setOptions] = useState(() => drafts(initial));
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(options) !== JSON.stringify(drafts(saved));
  function patch(id: string, update: Partial<DraftPrice>) {
    setOptions((options) =>
      options.map((option) => (option.id === id ? { ...option, ...update } : option)),
    );
    setError('');
    setMessage('');
  }
  return (
    <Card role="article" aria-label={saved.name} className="gap-5 overflow-hidden shadow-xs">
      <CardHeader className="flex flex-row items-center gap-3">
        <span className="admin-thumbnail">
          <ProductImage src={saved.thumbnail_url} alt="" />
        </span>
        <div className="min-w-0 flex-1">
          <CardTitle>
            <Link
              href={`/admin/products/${saved.id}`}
              className="text-base font-semibold hover:underline"
            >
              {saved.name}
            </Link>
          </CardTitle>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={saved.status} />
            {saved.has_variants ? (
              <span className="text-xs text-muted-foreground">{options.length} options</span>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError('');
            setMessage('');
            startTransition(async () => {
              try {
                const result = await savePrices({
                  id: saved.id,
                  expected_updated_at: saved.updated_at,
                  options: options.map((option) => ({
                    id: option.id,
                    price: roundRupees(Number(option.price)),
                    discount_type: option.discount_type,
                    discount_value:
                      option.discount_type === 'none'
                        ? 0
                        : option.discount_type === 'amount'
                          ? roundRupees(Number(option.discount_value))
                          : Number(option.discount_value),
                  })),
                });
                if (result.error) setError(result.error);
                if (result.success) setMessage(result.success);
                if (result.record) {
                  setSaved(result.record);
                  setOptions(drafts(result.record));
                }
                setNeedsRefresh(result.refreshRequired ?? false);
              } catch {
                setError('Prices could not be saved. Try again.');
              }
            });
          }}
        >
          <FormReady disabled={pending || needsRefresh} className="min-w-0 space-y-5">
            <div className="space-y-5">
              {options.map((option, index) => {
                const price = Number(option.price);
                const discount = Number(option.discount_value);
                const valid =
                  option.price !== '' &&
                  Number.isFinite(price) &&
                  price >= 0 &&
                  price <= 1000000 &&
                  (option.discount_type === 'none' ||
                    (option.discount_value !== '' &&
                      Number.isFinite(discount) &&
                      discount >= 0 &&
                      discount <= (option.discount_type === 'percentage' ? 100 : price)));
                const selling = valid
                  ? discountedPrice(
                      roundRupees(price),
                      option.discount_type,
                      option.discount_type === 'amount' ? roundRupees(discount) : discount,
                    )
                  : null;
                return (
                  <fieldset
                    key={option.id}
                    aria-label={saved.has_variants ? option.title : 'Product price'}
                    className={index ? 'min-w-0 space-y-4 border-t pt-5' : 'min-w-0 space-y-4'}
                  >
                    {saved.has_variants ? (
                      <legend className="mb-3 text-sm font-medium">{option.title}</legend>
                    ) : null}
                    <div className="grid min-w-0 items-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <AdminField label="Price (₹)">
                        <Input
                          type="number"
                          required
                          min="0"
                          max="1000000"
                          step="1"
                          inputMode="numeric"
                          value={option.price}
                          onChange={(event) => patch(option.id, { price: event.target.value })}
                          onBlur={(event) => {
                            if (event.currentTarget.value !== '')
                              patch(option.id, {
                                price: String(roundRupees(Number(event.currentTarget.value))),
                              });
                          }}
                        />
                      </AdminField>
                      <AdminField label="Discount">
                        <AdminSelect
                          value={option.discount_type}
                          options={discountOptions}
                          onValueChange={(value) =>
                            patch(option.id, {
                              discount_type: value as DraftPrice['discount_type'],
                              discount_value: '',
                            })
                          }
                        />
                      </AdminField>
                      {option.discount_type !== 'none' ? (
                        <AdminField
                          label={
                            option.discount_type === 'percentage' ? 'Discount (%)' : 'Discount (₹)'
                          }
                        >
                          <Input
                            type="number"
                            required
                            min="0"
                            max={option.discount_type === 'percentage' ? 100 : option.price}
                            step={option.discount_type === 'percentage' ? '0.01' : '1'}
                            value={option.discount_value}
                            onChange={(event) =>
                              patch(option.id, { discount_value: event.target.value })
                            }
                            onBlur={(event) => {
                              if (
                                option.discount_type === 'amount' &&
                                event.currentTarget.value !== ''
                              )
                                patch(option.id, {
                                  discount_value: String(
                                    roundRupees(Number(event.currentTarget.value)),
                                  ),
                                });
                            }}
                          />
                        </AdminField>
                      ) : null}
                      <div className="space-y-2 xl:col-start-4">
                        <span className="block text-sm font-medium">Selling price</span>
                        <output className="block text-xl font-semibold" aria-live="polite">
                          {selling == null ? '—' : money(selling)}
                        </output>
                        {selling != null && selling < roundRupees(price) ? (
                          <span className="block text-xs text-muted-foreground">
                            Save {money(roundRupees(price) - selling)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </fieldset>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t pt-4">
              <Button type="submit" disabled={pending || !dirty}>
                <Save />
                {pending ? 'Saving…' : 'Save prices'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={pending || !dirty}
                onClick={() => {
                  setOptions(drafts(saved));
                  setError('');
                  setMessage('');
                }}
              >
                <RotateCcw />
                Reset
              </Button>
            </div>
          </FormReady>
          {error ? <FieldError>{error}</FieldError> : null}
          {message ? (
            <p role="status" className="text-sm text-emerald-800">
              {message}
            </p>
          ) : null}
          {needsRefresh ? (
            <Button type="button" variant="outline" onClick={() => window.location.reload()}>
              Refresh prices
            </Button>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
