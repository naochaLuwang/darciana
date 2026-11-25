'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveBulkStock } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { StatusBadge } from './common';
import { useAdminReady } from './form-controls';
import { StockEditor } from './stock-editor';

export type InventoryProduct = {
  id: string;
  name: string;
  has_variants: boolean;
  product_variants: { id: string; title: string; stock: number; updated_at: string }[];
};

export function InventoryList({
  products,
  filtered,
}: {
  products: InventoryProduct[];
  filtered: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [quantity, setQuantity] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<{ id: string; error: string }[]>([]);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const ready = useAdminReady();
  const router = useRouter();
  const rows = products.flatMap((product) =>
    product.product_variants.map((variant) => ({
      ...variant,
      label: product.has_variants ? `${product.name} — ${variant.title}` : product.name,
    })),
  );
  const selectedRows = rows.filter((row) => selected.has(row.id));
  function checked(ids: string[]): boolean | 'indeterminate' {
    const count = ids.filter((id) => selected.has(id)).length;
    return count === 0 ? false : count === ids.length ? true : 'indeterminate';
  }
  function toggle(ids: string[]) {
    setSelected((previous) => {
      const next = new Set(previous);
      const remove = ids.every((id) => previous.has(id));
      ids.forEach((id) => (remove ? next.delete(id) : next.add(id)));
      return next;
    });
  }
  const selection = (ids: string[], label: string, text?: string) => (
    <label className={`admin-inventory-select${text ? ' admin-inventory-select-all' : ''}`}>
      <Checkbox
        aria-label={label}
        checked={checked(ids)}
        disabled={!ready || pending || !ids.length}
        onCheckedChange={() => toggle(ids)}
      />
      {text ? <span>{text}</span> : null}
    </label>
  );
  return (
    <>
      <div className="admin-inventory-list-heading">
        <div>
          <h2>Stock list</h2>
          <p>Select rows to update stock in bulk.</p>
        </div>
        {selection(
          rows.map((row) => row.id),
          'Select all rows on this page',
          'Select all on this page',
        )}
      </div>
      {!!selectedRows.length && (
        <form
          className="admin-inventory-bulk"
          onSubmit={(event) => {
            event.preventDefault();
            setError('');
            setErrors([]);
            setMessage('');
            startTransition(async () => {
              try {
                const result = await saveBulkStock(
                  selectedRows.map((row) => ({
                    id: row.id,
                    stock: Number(quantity),
                    expected_updated_at: row.updated_at,
                  })),
                );
                if (result.error) {
                  setError(result.error);
                  return;
                }
                setMessage(
                  result.updated.length
                    ? `Updated stock for ${result.updated.length} ${result.updated.length === 1 ? 'row' : 'rows'}.`
                    : '',
                );
                setErrors(result.failed);
                setSelected(
                  (previous) => new Set([...previous].filter((id) => !result.updated.includes(id))),
                );
                router.refresh();
              } catch {
                setError('Could not confirm the update. Refresh inventory before trying again.');
              }
            });
          }}
        >
          <strong>{selectedRows.length} selected</strong>
          <label className="admin-inventory-bulk-quantity">
            <span>Set stock to</span>
            <Input
              type="number"
              min="0"
              max="1000000"
              step="1"
              required
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              disabled={pending}
            />
            <span>each</span>
          </label>
          <Button disabled={pending || quantity === ''}>
            {pending ? 'Updating…' : 'Update selected'}
          </Button>
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
      {message && (
        <p role="status" className="admin-inventory-feedback admin-saved">
          {message}
        </p>
      )}
      {(error || !!errors.length) && (
        <div role="alert" className="admin-inventory-feedback form-error">
          {error ? (
            <p>{error}</p>
          ) : (
            <>
              <p>
                {errors.length} {errors.length === 1 ? 'row was' : 'rows were'} not updated. Review
                the selected rows before trying again.
              </p>
              <ul>
                {errors.map((item) => (
                  <li key={item.id}>
                    {rows.find((row) => row.id === item.id)?.label ?? 'Selected row'}: {item.error}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      {rows.length ? (
        <Table className="admin-inventory-table" aria-label="Product inventory">
          <TableHeader>
            <TableRow>
              <TableHead className="admin-inventory-selection">
                <span className="sr-only">Select</span>
              </TableHead>
              <TableHead>Product / variant</TableHead>
              <TableHead>Availability</TableHead>
              <TableHead>Stock quantity</TableHead>
            </TableRow>
          </TableHeader>
          {products.map((product) => (
            <TableBody key={product.id}>
              {product.has_variants && (
                <TableRow className="admin-inventory-group" aria-label={product.name}>
                  <TableCell className="admin-inventory-selection">
                    {selection(
                      product.product_variants.map((variant) => variant.id),
                      `Select all variants of ${product.name}`,
                    )}
                  </TableCell>
                  <TableCell colSpan={3}>
                    <Link href={`/admin/products/${product.id}`} className="admin-inventory-name">
                      <strong>{product.name}</strong>
                    </Link>
                    <small>
                      {product.product_variants.length}{' '}
                      {product.product_variants.length === 1 ? 'variant' : 'variants'}
                      {filtered ? ' shown' : ''}
                    </small>
                  </TableCell>
                </TableRow>
              )}
              {product.product_variants.map((variant) => {
                const label = product.has_variants
                  ? `${product.name} — ${variant.title}`
                  : product.name;
                return (
                  <TableRow
                    key={variant.id}
                    aria-label={label}
                    data-selected={selected.has(variant.id) ? 'true' : undefined}
                    className={product.has_variants ? 'admin-inventory-variant' : undefined}
                  >
                    <TableCell className="admin-inventory-selection">
                      {selection([variant.id], `Select ${label}`)}
                    </TableCell>
                    <TableCell className="admin-inventory-product">
                      {product.has_variants ? (
                        <span className="admin-inventory-variant-name">{variant.title}</span>
                      ) : (
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="admin-inventory-name"
                        >
                          <strong>{product.name}</strong>
                        </Link>
                      )}
                    </TableCell>
                    <TableCell className="admin-inventory-availability">
                      <StatusBadge
                        status={
                          variant.stock === 0
                            ? 'out_of_stock'
                            : variant.stock <= 5
                              ? 'low'
                              : 'in_stock'
                        }
                      >
                        {variant.stock === 0
                          ? 'Out of stock'
                          : variant.stock <= 5
                            ? 'Low stock'
                            : 'In stock'}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="admin-inventory-quantity">
                      <span className="admin-inventory-mobile-label" aria-hidden="true">
                        Stock quantity
                      </span>
                      <StockEditor
                        id={variant.id}
                        stock={variant.stock}
                        updatedAt={variant.updated_at}
                        disabled={pending}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          ))}
        </Table>
      ) : (
        <div className="admin-empty">
          <h3>No matching inventory</h3>
          <p>Try another product name or clear the filters.</p>
        </div>
      )}
    </>
  );
}
