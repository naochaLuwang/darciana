'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { savePrices } from '@/app/admin/prices/actions';
import { discountedPrice } from '@/lib/commerce';
import { money, roundRupees } from '@/lib/money';
import type { ProductPricing, PriceOption } from '@/lib/product-pricing';
import { ProductImage } from '@/components/product-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldError } from '@/components/ui/field';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { AdminField, AdminSelect, FormReady, useAdminReady } from './form-controls';

type DraftPrice = Omit<PriceOption, 'price' | 'discount_value'> & {
  price: string;
  discount_value: string;
};
const discountOptions = [
  { value: 'none', label: 'No discount' },
  { value: 'amount', label: '₹ off' },
  { value: 'percentage', label: '% off' },
];
function drafts(product: ProductPricing): DraftPrice[] {
  return product.options.map((option) => ({
    ...option,
    price: String(option.price),
    discount_value: option.discount_type === 'none' ? '' : String(option.discount_value),
  }));
}
function validPrice(option: DraftPrice) {
  const price = Number(option.price);
  const discount = Number(option.discount_value);
  if (option.price === '' || !Number.isFinite(price) || price < 0 || price > 1000000) return false;
  if (option.discount_type === 'none') return true;
  if (option.discount_value === '' || !Number.isFinite(discount) || discount < 0) return false;
  return option.discount_type === 'percentage'
    ? discount <= 100 && Math.abs(discount * 100 - Math.round(discount * 100)) < 0.00001
    : roundRupees(discount) <= roundRupees(price);
}
export function PriceEditor({ initial }: { initial: ProductPricing }) {
  const ready = useAdminReady();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(initial);
  const [options, setOptions] = useState(() => drafts(initial));
  const [selectedId, setSelectedId] = useState(initial.options[0]?.id ?? '');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(options) !== JSON.stringify(drafts(saved));
  const option = options.find((option) => option.id === selectedId) ?? options[0];
  const selling =
    option && validPrice(option)
      ? discountedPrice(
          roundRupees(Number(option.price)),
          option.discount_type,
          option.discount_type === 'amount'
            ? roundRupees(Number(option.discount_value))
            : Number(option.discount_value),
        )
      : null;
  const prices = saved.options.map((option) =>
    discountedPrice(option.price, option.discount_type, option.discount_value),
  );
  const lowest = prices.length ? Math.min(...prices) : null;
  const differentPrices = new Set(prices).size > 1;
  function patch(update: Partial<DraftPrice>) {
    if (!option) return;
    setOptions((options) =>
      options.map((item) => (item.id === option.id ? { ...item, ...update } : item)),
    );
    setError('');
    setMessage('');
  }
  return (
    <div role="article" aria-label={saved.name} className="border-b last:border-b-0">
      <Sheet
        open={open}
        onOpenChange={(value) => {
          if (pending) return;
          setOpen(value);
          if (value) {
            setOptions(drafts(saved));
            setSelectedId((current) =>
              saved.options.some((option) => option.id === current)
                ? current
                : (saved.options[0]?.id ?? ''),
            );
            if (!needsRefresh) {
              setError('');
              setMessage('');
            }
          }
        }}
      >
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            disabled={!ready}
            aria-label={`Edit prices for ${saved.name}`}
            className="h-auto w-full justify-start gap-3 rounded-none px-4 py-4 text-left font-normal whitespace-normal sm:px-5"
          >
            <span className="admin-thumbnail">
              <ProductImage src={saved.thumbnail_url} alt="" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-sm font-medium break-words">{saved.name}</span>
              {saved.has_variants ? (
                <span className="mt-1 block text-xs text-muted-foreground">
                  {saved.options.length} options
                </span>
              ) : null}
            </span>
            <span className="shrink-0 whitespace-nowrap text-right">
              <span className="block text-sm font-semibold">
                {differentPrices ? (
                  <span className="font-normal text-muted-foreground">From </span>
                ) : null}
                {lowest == null ? '—' : money(lowest)}
              </span>
              {message && !open ? (
                <span role="status" className="mt-1 block text-xs text-emerald-800">
                  Saved
                </span>
              ) : null}
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        </SheetTrigger>
        <SheetContent
          className="w-full gap-0 sm:max-w-md"
          onEscapeKeyDown={(event) => {
            if (pending) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (pending) event.preventDefault();
          }}
        >
          <SheetHeader className="border-b px-5 py-5 pr-12">
            <SheetTitle>{saved.name}</SheetTitle>
            <SheetDescription className="sr-only">
              Edit the price and optional discount
            </SheetDescription>
          </SheetHeader>
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              setError('');
              setMessage('');
              const invalid = options.find((option) => !validPrice(option));
              if (invalid) {
                setSelectedId(invalid.id);
                setError(
                  `Check the price and discount${saved.has_variants ? ` for ${invalid.title}` : ''}.`,
                );
                return;
              }
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
                    setOpen(false);
                  }
                  setNeedsRefresh(result.refreshRequired ?? false);
                } catch {
                  setError('Prices could not be saved. Try again.');
                }
              });
            }}
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-6">
              <FormReady disabled={pending || needsRefresh} className="min-w-0 space-y-5">
                {options.length > 1 ? (
                  <AdminField label="Option">
                    <AdminSelect
                      value={option?.id ?? ''}
                      onValueChange={(value) => {
                        setSelectedId(value);
                        setError('');
                      }}
                      options={options.map((option) => ({ value: option.id, label: option.title }))}
                    />
                  </AdminField>
                ) : null}
                {option ? (
                  <fieldset
                    key={option.id}
                    aria-label={saved.has_variants ? option.title : 'Product price'}
                    className="min-w-0 space-y-5"
                  >
                    <AdminField label="Price (₹)">
                      <Input
                        type="number"
                        required
                        min="0"
                        max="1000000"
                        step="1"
                        inputMode="numeric"
                        value={option.price}
                        onChange={(event) => patch({ price: event.target.value })}
                        onBlur={(event) => {
                          if (event.currentTarget.value !== '')
                            patch({
                              price: String(roundRupees(Number(event.currentTarget.value))),
                            });
                        }}
                      />
                    </AdminField>
                    {option.discount_type === 'none' ? (
                      <Button
                        type="button"
                        variant="link"
                        className="h-9 px-0"
                        onClick={() => patch({ discount_type: 'percentage', discount_value: '' })}
                      >
                        <Plus />
                        Add discount
                      </Button>
                    ) : (
                      <div className="grid grid-cols-2 items-start gap-3">
                        <AdminField label="Discount">
                          <AdminSelect
                            value={option.discount_type}
                            options={discountOptions}
                            onValueChange={(value) =>
                              patch({
                                discount_type: value as DraftPrice['discount_type'],
                                discount_value: '',
                              })
                            }
                          />
                        </AdminField>
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
                            onChange={(event) => patch({ discount_value: event.target.value })}
                            onBlur={(event) => {
                              if (
                                option.discount_type === 'amount' &&
                                event.currentTarget.value !== ''
                              )
                                patch({
                                  discount_value: String(
                                    roundRupees(Number(event.currentTarget.value)),
                                  ),
                                });
                            }}
                          />
                        </AdminField>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 p-4">
                      <span className="text-sm text-muted-foreground">Selling price</span>
                      <output aria-live="polite" className="text-xl font-semibold">
                        {selling == null ? '—' : money(selling)}
                      </output>
                    </div>
                  </fieldset>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Add an option in the{' '}
                    <Link href={`/admin/products/${saved.id}`} className="underline">
                      product editor
                    </Link>{' '}
                    to set a price.
                  </p>
                )}
              </FormReady>
              {error ? <FieldError>{error}</FieldError> : null}
              {message && open ? (
                <p role="status" className="text-sm text-emerald-800">
                  {message}
                </p>
              ) : null}
              {needsRefresh ? (
                <Button type="button" variant="outline" onClick={() => window.location.reload()}>
                  Refresh prices
                </Button>
              ) : null}
            </div>
            <SheetFooter className="flex-row gap-3 border-t bg-background p-5">
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-11 flex-1"
                disabled={!ready || pending || needsRefresh || !dirty || !option}
              >
                {pending ? 'Saving…' : 'Save changes'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
