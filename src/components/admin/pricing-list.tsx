'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { RotateCcw } from 'lucide-react';
import { savePrices, saveBulkPrices, type PricingResult } from '@/app/admin/prices/actions';
import { discountedPrice } from '@/lib/commerce';
import { money, roundRupees } from '@/lib/money';
import {
  optionPriceSchema,
  pricingSchema,
  type ProductPricing,
  type PriceOption,
  type PricingInput,
} from '@/lib/product-pricing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { useAdminReady } from './form-controls';

type Draft = Omit<PriceOption, 'price' | 'discount_value'> & {
  price: string;
  discount_value: string;
};
const draftFor = (option: PriceOption): Draft => ({
  ...option,
  price: String(option.price),
  discount_value: option.discount_type === 'none' ? '' : String(option.discount_value),
});
function parsedDraft(draft: Draft) {
  if (draft.price === '') return { error: 'Enter a price.' };
  if (draft.discount_type !== 'none' && draft.discount_value === '')
    return { error: 'Enter a discount value.' };
  const price = Number(draft.price);
  const discount = Number(draft.discount_value);
  const parsed = optionPriceSchema.safeParse({
    ...draft,
    price: price >= 0 ? roundRupees(price) : price,
    discount_value:
      draft.discount_type === 'none'
        ? 0
        : draft.discount_type === 'amount' && discount >= 0
          ? roundRupees(discount)
          : discount,
  });
  return parsed.success ? { value: parsed.data } : { error: parsed.error.issues[0].message };
}
export function PricingList({ products }: { products: ProductPricing[] }) {
  const [records, setRecords] = useState(products);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      products.flatMap((product) => product.options.map((option) => [option.id, draftFor(option)])),
    ),
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [problems, setProblems] = useState<Record<string, PricingResult>>({});
  const [savedRows, setSavedRows] = useState<Set<string>>(() => new Set());
  const [pending, startTransition] = useTransition();
  const [bulkMode, setBulkMode] = useState('price');
  const [bulkType, setBulkType] = useState<PriceOption['discount_type']>('percentage');
  const [bulkValue, setBulkValue] = useState('');
  const [bulkError, setBulkError] = useState('');
  const [bulkMessage, setBulkMessage] = useState('');
  const ready = useAdminReady();
  const rows = records.flatMap((product) => product.options);
  const selectedRows = rows.filter((option) => selected.has(option.id));
  function patch(id: string, update: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...update } }));
    setSavedRows((current) => new Set([...current].filter((value) => value !== id)));
  }
  function toggle(ids: string[]) {
    setSelected((previous) => {
      const next = new Set(previous);
      const remove = ids.every((id) => previous.has(id));
      ids.forEach((id) => (remove ? next.delete(id) : next.add(id)));
      return next;
    });
  }
  function selection(ids: string[], label: string, text?: string, blocked = false) {
    const count = ids.filter((id) => selected.has(id)).length;
    return (
      <label className={`admin-inventory-select${text ? ' admin-inventory-select-all' : ''}`}>
        <Checkbox
          aria-label={label}
          checked={count === 0 ? false : count === ids.length ? true : 'indeterminate'}
          disabled={!ready || pending || blocked || !ids.length}
          onCheckedChange={() => toggle(ids)}
        />
        {text && <span>{text}</span>}
      </label>
    );
  }
  function merge(product: ProductPricing, result: PricingResult, ids: string[]) {
    setProblems((current) => ({ ...current, [product.id]: result }));
    if (!result.record) return;
    const record = result.record;
    setRecords((current) => current.map((item) => (item.id === record.id ? record : item)));
    setDrafts((current) => {
      const next = { ...current };
      for (const option of record.options) {
        const original = product.options.find((item) => item.id === option.id);
        if (
          ids.includes(option.id) ||
          !original ||
          JSON.stringify(current[option.id]) === JSON.stringify(draftFor(original))
        )
          next[option.id] = draftFor(option);
      }
      return next;
    });
    setSavedRows((current) => new Set([...current, ...ids]));
  }
  function saveRow(product: ProductPricing, option: PriceOption) {
    if (pending || problems[product.id]?.refreshRequired) return;
    const parsed = parsedDraft(drafts[option.id]);
    if (!parsed.value) {
      setProblems((current) => ({ ...current, [product.id]: { error: parsed.error } }));
      return;
    }
    startTransition(async () => {
      try {
        const result = await savePrices({
          id: product.id,
          expected_updated_at: product.updated_at,
          options: product.options.map((item) => (item.id === option.id ? parsed.value : item)),
        });
        merge(product, result, [option.id]);
      } catch {
        setProblems((current) => ({
          ...current,
          [product.id]: {
            error: 'Could not confirm the update. Refresh prices before trying again.',
            refreshRequired: true,
          },
        }));
      }
    });
  }
  function bulkSave() {
    if (pending || !selectedRows.length) return;
    setBulkError('');
    setBulkMessage('');
    const inputs: PricingInput[] = [];
    const touched = records.filter((product) =>
      product.options.some((option) => selected.has(option.id)),
    );
    for (const product of touched) {
      if (problems[product.id]?.refreshRequired) {
        setBulkError(`Refresh ${product.name} before updating prices.`);
        return;
      }
      const options = product.options.map((option) => {
        if (!selected.has(option.id)) return option;
        const update =
          bulkMode === 'price'
            ? { price: bulkValue }
            : { discount_type: bulkType, discount_value: bulkType === 'none' ? '' : bulkValue };
        return parsedDraft({ ...draftFor(option), ...update }).value;
      });
      const parsed = pricingSchema.safeParse({
        id: product.id,
        expected_updated_at: product.updated_at,
        options,
      });
      if (!parsed.success) {
        setBulkError(`${product.name}: Check the price and discount for the selected rows.`);
        return;
      }
      inputs.push(parsed.data);
    }
    startTransition(async () => {
      try {
        const result = await saveBulkPrices(inputs);
        if (result.error) {
          setBulkError(result.error);
          return;
        }
        const successful: string[] = [];
        let failed = 0;
        for (const saved of result.results) {
          const product = touched.find((item) => item.id === saved.id)!;
          const ids = product.options
            .filter((option) => selected.has(option.id))
            .map((option) => option.id);
          merge(product, saved, ids);
          if (saved.error) failed++;
          else successful.push(...ids);
        }
        setSelected((current) => new Set([...current].filter((id) => !successful.includes(id))));
        setBulkMessage(
          successful.length
            ? `Updated prices for ${successful.length} ${successful.length === 1 ? 'row' : 'rows'}.`
            : '',
        );
        if (failed)
          setBulkError(
            `${failed} ${failed === 1 ? 'product was' : 'products were'} not updated. Review the selected products below.`,
          );
      } catch {
        setBulkError('Could not confirm all updates. Refresh prices before trying again.');
        setProblems((current) => ({
          ...current,
          ...Object.fromEntries(
            touched.map((product) => [
              product.id,
              { error: 'Refresh prices before retrying this update.', refreshRequired: true },
            ]),
          ),
        }));
      }
    });
  }
  return (
    <>
      <div className="admin-inventory-list-heading">
        <div>
          <h2>Price list</h2>
          <p>Edit a row or select products and variants for a bulk update.</p>
        </div>
        {selection(
          rows.map((row) => row.id),
          'Select all rows on this page',
          'Select all on this page',
        )}
      </div>
      {!!selectedRows.length && (
        <form
          className="admin-inventory-bulk admin-pricing-bulk"
          aria-label="Bulk price update"
          onSubmit={(event) => {
            event.preventDefault();
            bulkSave();
          }}
        >
          <strong>{selectedRows.length} selected</strong>
          <NativeSelect
            aria-label="Bulk update field"
            value={bulkMode}
            onChange={(event) => {
              setBulkMode(event.target.value);
              setBulkValue('');
            }}
            disabled={pending}
          >
            <NativeSelectOption value="price">Set price</NativeSelectOption>
            <NativeSelectOption value="discount">Set discount</NativeSelectOption>
          </NativeSelect>
          {bulkMode === 'discount' && (
            <NativeSelect
              aria-label="Bulk discount type"
              value={bulkType}
              onChange={(event) => {
                setBulkType(event.target.value as PriceOption['discount_type']);
                setBulkValue('');
              }}
              disabled={pending}
            >
              <NativeSelectOption value="none">No discount</NativeSelectOption>
              <NativeSelectOption value="amount">₹ off</NativeSelectOption>
              <NativeSelectOption value="percentage">% off</NativeSelectOption>
            </NativeSelect>
          )}
          {(bulkMode === 'price' || bulkType !== 'none') && (
            <Input
              aria-label={
                bulkMode === 'price'
                  ? 'Bulk price (₹)'
                  : bulkType === 'amount'
                    ? 'Bulk discount (₹)'
                    : 'Bulk discount (%)'
              }
              type="number"
              required
              min="0"
              max={bulkMode === 'discount' && bulkType === 'percentage' ? 100 : 1000000}
              step={bulkMode === 'discount' && bulkType === 'percentage' ? '0.01' : '1'}
              value={bulkValue}
              onChange={(event) => setBulkValue(event.target.value)}
              onBlur={() => {
                if (bulkValue !== '' && !(bulkMode === 'discount' && bulkType === 'percentage'))
                  setBulkValue(String(roundRupees(Number(bulkValue))));
              }}
              disabled={pending}
            />
          )}
          <Button disabled={pending}>{pending ? 'Saving…' : 'Update selected'}</Button>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => setSelected(new Set())}
          >
            Clear selection
          </Button>
        </form>
      )}
      {bulkMessage && (
        <p role="status" className="admin-inventory-feedback admin-saved">
          {bulkMessage}
        </p>
      )}
      {bulkError && (
        <p role="alert" className="admin-inventory-feedback form-error">
          {bulkError}
        </p>
      )}
      <Table className="admin-pricing-table" aria-label="Product prices">
        <TableHeader>
          <TableRow>
            <TableHead className="admin-pricing-selection">
              <span className="sr-only">Select</span>
            </TableHead>
            <TableHead>Product / variant</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Discount</TableHead>
            <TableHead>Selling price</TableHead>
            <TableHead>Update</TableHead>
          </TableRow>
        </TableHeader>
        {records.map((product) => {
          const problem = problems[product.id];
          const blocked = !!problem?.refreshRequired;
          return (
            <TableBody key={product.id}>
              {(product.has_variants || !product.options.length) && (
                <TableRow
                  className="admin-inventory-group admin-pricing-group"
                  aria-label={product.name}
                >
                  <TableCell className="admin-pricing-selection">
                    {selection(
                      product.options.map((option) => option.id),
                      `Select all variants of ${product.name}`,
                      undefined,
                      blocked,
                    )}
                  </TableCell>
                  <TableCell colSpan={5}>
                    <Link className="admin-inventory-name" href={`/admin/products/${product.id}`}>
                      <strong>{product.name}</strong>
                    </Link>
                    <small>
                      {product.options.length}{' '}
                      {product.options.length === 1 ? 'variant' : 'variants'} ·{' '}
                      {product.status === 'active' ? 'Active' : 'Inactive'}
                    </small>
                    {!product.options.length && (
                      <small>Add an option in the product editor to set its price.</small>
                    )}
                  </TableCell>
                </TableRow>
              )}
              {(problem?.error || blocked) && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <div role="alert" className="admin-pricing-problem">
                      <p>
                        {problem.error ??
                          problem.success ??
                          'Refresh prices before making more changes.'}
                      </p>
                      {blocked && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.location.reload()}
                        >
                          Refresh prices
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {product.options.map((option) => {
                const draft = drafts[option.id];
                const parsed = parsedDraft(draft);
                const selling = parsed.value
                  ? discountedPrice(
                      parsed.value.price,
                      parsed.value.discount_type,
                      parsed.value.discount_value,
                    )
                  : null;
                const dirty = JSON.stringify(draft) !== JSON.stringify(draftFor(option));
                const disabled = !ready || pending || blocked;
                const formId = `pricing-${option.id}`;
                const label = product.has_variants
                  ? `${product.name} — ${option.title}`
                  : product.name;
                return (
                  <TableRow
                    key={option.id}
                    aria-label={label}
                    data-selected={selected.has(option.id) ? 'true' : undefined}
                    className={product.has_variants ? 'admin-pricing-variant' : undefined}
                  >
                    <TableCell className="admin-pricing-selection">
                      {selection([option.id], `Select ${label}`, undefined, blocked)}
                    </TableCell>
                    <TableCell className="admin-pricing-name">
                      {product.has_variants ? (
                        <span className="admin-inventory-variant-name">{option.title}</span>
                      ) : (
                        <>
                          <Link
                            className="admin-inventory-name"
                            href={`/admin/products/${product.id}`}
                          >
                            <strong>{product.name}</strong>
                          </Link>
                          <small>{product.status === 'active' ? 'Active' : 'Inactive'}</small>
                        </>
                      )}
                    </TableCell>
                    <TableCell className="admin-pricing-price">
                      <span className="admin-pricing-mobile-label" aria-hidden="true">
                        Price (₹)
                      </span>
                      <Input
                        form={formId}
                        aria-label="Price (₹)"
                        type="number"
                        min="0"
                        max="1000000"
                        step="1"
                        required
                        value={draft.price}
                        disabled={disabled}
                        onChange={(event) => patch(option.id, { price: event.target.value })}
                        onBlur={() => {
                          if (draft.price !== '' && Number(draft.price) >= 0)
                            patch(option.id, { price: String(roundRupees(Number(draft.price))) });
                        }}
                      />
                    </TableCell>
                    <TableCell className="admin-pricing-discount">
                      <span className="admin-pricing-mobile-label" aria-hidden="true">
                        Discount
                      </span>
                      <div>
                        <NativeSelect
                          form={formId}
                          aria-label="Discount type"
                          value={draft.discount_type}
                          disabled={disabled}
                          onChange={(event) =>
                            patch(option.id, {
                              discount_type: event.target.value as PriceOption['discount_type'],
                              discount_value: '',
                            })
                          }
                        >
                          <NativeSelectOption value="none">No discount</NativeSelectOption>
                          <NativeSelectOption value="amount">₹ off</NativeSelectOption>
                          <NativeSelectOption value="percentage">% off</NativeSelectOption>
                        </NativeSelect>
                        {draft.discount_type !== 'none' && (
                          <Input
                            form={formId}
                            aria-label={
                              draft.discount_type === 'amount' ? 'Discount (₹)' : 'Discount (%)'
                            }
                            type="number"
                            min="0"
                            max={draft.discount_type === 'percentage' ? 100 : 1000000}
                            step={draft.discount_type === 'percentage' ? '0.01' : '1'}
                            required
                            value={draft.discount_value}
                            disabled={disabled}
                            onChange={(event) =>
                              patch(option.id, { discount_value: event.target.value })
                            }
                            onBlur={() => {
                              if (
                                draft.discount_type === 'amount' &&
                                draft.discount_value !== '' &&
                                Number(draft.discount_value) >= 0
                              )
                                patch(option.id, {
                                  discount_value: String(roundRupees(Number(draft.discount_value))),
                                });
                            }}
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="admin-pricing-selling">
                      <span className="admin-pricing-mobile-label" aria-hidden="true">
                        Selling price
                      </span>
                      <output aria-label="Selling price">
                        {selling === null ? '—' : money(selling)}
                      </output>
                    </TableCell>
                    <TableCell className="admin-pricing-actions">
                      <form
                        id={formId}
                        aria-label={`Update price for ${label}`}
                        onSubmit={(event) => {
                          event.preventDefault();
                          saveRow(product, option);
                        }}
                      >
                        <div>
                          <Button variant="outline" size="sm" disabled={disabled || !dirty}>
                            Save price
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Reset price for ${label}`}
                            disabled={disabled || !dirty}
                            onClick={() => {
                              patch(option.id, draftFor(option));
                              setProblems((current) => ({ ...current, [product.id]: {} }));
                            }}
                          >
                            <RotateCcw size={15} />
                          </Button>
                        </div>
                        {savedRows.has(option.id) && (
                          <p role="status" className="admin-saved">
                            Saved
                          </p>
                        )}
                      </form>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          );
        })}
      </Table>
    </>
  );
}
