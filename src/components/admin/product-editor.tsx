'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Save, ExternalLink } from 'lucide-react';
import { saveProduct, saveProductStatus } from '@/app/admin/actions';
import { slugify, type ProductInput } from '@/lib/admin-validation';
import type { AdminProduct } from '@/lib/admin';
import type { Category } from '@/lib/commerce';
import { ImageField } from './image-field';
import { roundRupees } from '@/lib/money';

type DraftVariant = ProductInput['variants'][number] & { key: string };
function blankVariant(): DraftVariant {
  return {
    key: crypto.randomUUID(),
    id: null,
    title: 'Standard',
    sku: `DA-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    price: 0,
    stock: 0,
    image_url: '',
    hex_code: '',
    is_default: true,
    discount_type: 'none',
    discount_value: 0,
  };
}
export function ProductEditor({
  initial,
  categories,
}: {
  initial?: AdminProduct;
  categories: Category[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [slugEdited, setSlugEdited] = useState(!!initial);
  const [brand, setBrand] = useState(initial?.brand ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [status, setStatus] = useState(initial?.status ?? 'inactive');
  const [hasVariants, setHasVariants] = useState(initial?.has_variants ?? false);
  const [basePrice, setBasePrice] = useState(
    initial?.base_price == null ? '' : String(roundRupees(initial.base_price)),
  );
  const [discountType, setDiscountType] = useState(initial?.discount_type ?? 'none');
  const [discountValue, setDiscountValue] = useState(
    initial?.discount_type === 'amount'
      ? roundRupees(initial.discount_value)
      : (initial?.discount_value ?? 0),
  );
  const [image, setImage] = useState(initial?.thumbnail_url ?? '');
  const [categoryIds, setCategoryIds] = useState(initial?.categoryIds ?? []);
  const [variants, setVariants] = useState<DraftVariant[]>(() =>
    initial?.product_variants.length
      ? initial.product_variants.map((variant) => ({
          ...variant,
          price: roundRupees(variant.price),
          discount_value:
            variant.discount_type === 'amount'
              ? roundRupees(variant.discount_value)
              : variant.discount_value,
          key: variant.id,
          image_url: variant.image_url ?? '',
          hex_code: variant.hex_code ?? '',
          discount_type: variant.discount_type as DraftVariant['discount_type'],
        }))
      : [
          {
            key: 'initial',
            id: null,
            title: 'Standard',
            sku: '',
            price: 0,
            stock: 0,
            image_url: '',
            hex_code: '',
            is_default: true,
            discount_type: 'none',
            discount_value: 0,
          },
        ],
  );
  const [uploads, setUploads] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const trackUpload = (busy: boolean) => setUploads((count) => count + (busy ? 1 : -1));
  function patchVariant(index: number, patch: Partial<DraftVariant>) {
    setVariants((variants) =>
      variants.map((variant, i) => (i === index ? { ...variant, ...patch } : variant)),
    );
  }
  function submit() {
    setError('');
    setSuccess('');
    if (!hasVariants && basePrice === '') {
      setError('Enter a base price.');
      return;
    }
    const basePriceAmount = roundRupees(Number(basePrice));
    const data = {
      id: initial?.id ?? null,
      expected_updated_at: initial?.updated_at ?? null,
      name,
      slug,
      brand,
      description,
      status,
      has_variants: hasVariants,
      base_price: hasVariants ? null : basePriceAmount,
      thumbnail_url: image,
      category_ids: categoryIds,
      discount_type: hasVariants ? 'none' : discountType,
      discount_value: hasVariants || discountType === 'none' ? 0 : discountValue,
      variants: variants.map(({ key: _key, ...variant }) => ({
        ...variant,
        price: hasVariants ? variant.price : basePriceAmount,
        discount_type: hasVariants ? variant.discount_type : discountType,
        discount_value: hasVariants
          ? variant.discount_type === 'none'
            ? 0
            : variant.discount_value
          : discountType === 'none'
            ? 0
            : discountValue,
      })),
    };
    startTransition(async () => {
      try {
        const result = await saveProduct(data);
        if (result.error) setError(result.error);
        else if (result.id) {
          setSuccess('Product saved.');
          router.replace(`/admin/products/${result.id}`);
          router.refresh();
        }
      } catch {
        setError('The save could not finish. Please try again.');
      }
    });
  }
  return (
    <form
      className="admin-editor"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="admin-editor-main">
        <section className="admin-panel admin-form-section">
          <h2>Product details</h2>
          <label>
            Product name
            <input
              required
              maxLength={500}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (!slugEdited) setSlug(slugify(event.target.value));
              }}
            />
          </label>
          <div className="admin-form-grid">
            <label>
              URL slug
              <input
                required
                value={slug}
                maxLength={600}
                onChange={(event) => {
                  setSlugEdited(true);
                  setSlug(event.target.value);
                }}
              />
              <small>Changing a slug changes the product link.</small>
            </label>
            <label>
              Brand
              <input
                value={brand}
                maxLength={100}
                onChange={(event) => setBrand(event.target.value)}
              />
            </label>
          </div>
          <label>
            Description
            <textarea
              rows={7}
              value={description}
              maxLength={20000}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <ImageField
            label="Product image"
            value={image}
            onChange={setImage}
            onBusy={trackUpload}
          />
        </section>
        <section className="admin-panel admin-form-section">
          <div className="admin-panel-heading">
            <div>
              <h2>Price & options</h2>
              <p>All prices are in INR and include applicable taxes.</p>
            </div>
          </div>
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={hasVariants}
              disabled={variants.length > 1}
              onChange={(event) => setHasVariants(event.target.checked)}
            />
            This product has multiple options
          </label>
          {!hasVariants ? (
            <div className="admin-form-grid">
              <label>
                Base price (₹)
                <input
                  type="number"
                  required
                  min="0"
                  max="1000000"
                  step="1"
                  inputMode="numeric"
                  value={basePrice}
                  onChange={(event) => setBasePrice(event.target.value)}
                  onBlur={(event) => {
                    const value = event.currentTarget.value;
                    if (value !== '') setBasePrice(String(roundRupees(Number(value))));
                  }}
                />
              </label>
              <label>
                Discount
                <select
                  value={discountType}
                  onChange={(event) => {
                    setDiscountType(event.target.value);
                    setDiscountValue(0);
                  }}
                >
                  <option value="none">No discount</option>
                  <option value="amount">Amount off (₹)</option>
                  <option value="percentage">Percentage off (%)</option>
                </select>
              </label>
              {discountType !== 'none' ? (
                <label>
                  Discount value
                  <input
                    type="number"
                    required
                    min="0"
                    step={discountType === 'percentage' ? '0.01' : '1'}
                    max={discountType === 'percentage' ? 100 : basePrice}
                    value={discountValue}
                    onChange={(event) => setDiscountValue(Number(event.target.value))}
                    onBlur={(event) => {
                      if (discountType === 'amount')
                        setDiscountValue(roundRupees(Number(event.currentTarget.value)));
                    }}
                  />
                </label>
              ) : null}
            </div>
          ) : null}
          {variants.map((variant, index) => (
            <div className="admin-variant" key={variant.key}>
              <div className="admin-variant-heading">
                <h3>{hasVariants ? `Option ${index + 1}` : 'Stock details'}</h3>
                {hasVariants ? (
                  <label className="admin-checkbox">
                    <input
                      type="radio"
                      name="default-option"
                      checked={variant.is_default}
                      onChange={() =>
                        setVariants((variants) =>
                          variants.map((item, i) => ({ ...item, is_default: i === index })),
                        )
                      }
                    />
                    Default
                  </label>
                ) : null}
                {!variant.id && index > 0 ? (
                  <button
                    className="text-link"
                    type="button"
                    onClick={() =>
                      setVariants((variants) => {
                        const next = variants.filter((_, i) => i !== index);
                        return next.some((item) => item.is_default)
                          ? next
                          : next.map((item, i) => ({ ...item, is_default: i === 0 }));
                      })
                    }
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <div className="admin-form-grid">
                {hasVariants ? (
                  <label>
                    Option name
                    <input
                      aria-label={`Option ${index + 1} name`}
                      value={variant.title}
                      required
                      maxLength={200}
                      onChange={(event) => patchVariant(index, { title: event.target.value })}
                    />
                  </label>
                ) : null}
                <label>
                  SKU
                  <input
                    aria-label={`Option ${index + 1} SKU`}
                    value={variant.sku}
                    required
                    maxLength={1000}
                    onChange={(event) => patchVariant(index, { sku: event.target.value })}
                  />
                </label>
                <label>
                  Stock
                  <input
                    aria-label={`Option ${index + 1} stock`}
                    type="number"
                    min="0"
                    max="1000000"
                    step="1"
                    required
                    value={variant.stock}
                    onChange={(event) => patchVariant(index, { stock: Number(event.target.value) })}
                  />
                </label>
                {hasVariants ? (
                  <>
                    <label>
                      Price (₹)
                      <input
                        aria-label={`Option ${index + 1} price`}
                        type="number"
                        min="0"
                        max="1000000"
                        step="1"
                        required
                        value={variant.price}
                        onChange={(event) =>
                          patchVariant(index, { price: Number(event.target.value) })
                        }
                        onBlur={(event) =>
                          patchVariant(index, {
                            price: roundRupees(Number(event.currentTarget.value)),
                          })
                        }
                      />
                    </label>
                    <label>
                      Discount
                      <select
                        value={variant.discount_type}
                        onChange={(event) =>
                          patchVariant(index, {
                            discount_type: event.target.value as DraftVariant['discount_type'],
                            discount_value: 0,
                          })
                        }
                      >
                        <option value="none">No discount</option>
                        <option value="amount">Amount off (₹)</option>
                        <option value="percentage">Percentage off (%)</option>
                      </select>
                    </label>
                    {variant.discount_type !== 'none' ? (
                      <label>
                        Discount value
                        <input
                          type="number"
                          min="0"
                          step={variant.discount_type === 'percentage' ? '0.01' : '1'}
                          required
                          max={variant.discount_type === 'percentage' ? 100 : variant.price}
                          value={variant.discount_value}
                          onChange={(event) =>
                            patchVariant(index, { discount_value: Number(event.target.value) })
                          }
                          onBlur={(event) => {
                            if (variant.discount_type === 'amount')
                              patchVariant(index, {
                                discount_value: roundRupees(Number(event.currentTarget.value)),
                              });
                          }}
                        />
                      </label>
                    ) : null}
                    <label>
                      Colour hex (optional)
                      <input
                        value={variant.hex_code}
                        placeholder="#a58bb6"
                        onChange={(event) => patchVariant(index, { hex_code: event.target.value })}
                      />
                    </label>
                  </>
                ) : null}
              </div>
              {hasVariants ? (
                <ImageField
                  label={`Option ${index + 1} image`}
                  folder="variants"
                  value={variant.image_url}
                  onChange={(value) => patchVariant(index, { image_url: value })}
                  onBusy={trackUpload}
                />
              ) : null}
            </div>
          ))}
          {hasVariants ? (
            <button
              className="button button-outline"
              type="button"
              disabled={variants.length >= 100}
              onClick={() =>
                setVariants((variants) => [
                  ...variants,
                  { ...blankVariant(), title: '', is_default: false },
                ])
              }
            >
              <Plus size={16} />
              Add option
            </button>
          ) : null}
          <p className="admin-help">
            Keep existing options for their order history. Set unwanted options to zero stock.
          </p>
        </section>
      </div>
      <aside className="admin-editor-aside">
        <section className="admin-panel admin-form-section">
          <h2>Visibility</h2>
          <label>
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as 'active' | 'inactive')}
            >
              <option value="inactive">Inactive — hidden from shop</option>
              <option value="active">Active — visible in shop</option>
            </select>
          </label>
          <p className="admin-help">
            Inactive products stay in your catalog and can be reactivated.
          </p>
        </section>
        <section className="admin-panel admin-form-section">
          <h2>Categories</h2>
          <div className="admin-category-options">
            {categories.length ? (
              categories.map((category) => (
                <label key={category.id} className="admin-checkbox">
                  <input
                    type="checkbox"
                    checked={categoryIds.includes(category.id)}
                    onChange={(event) =>
                      setCategoryIds((ids) =>
                        event.target.checked
                          ? [...ids, category.id]
                          : ids.filter((id) => id !== category.id),
                      )
                    }
                  />
                  <span>
                    {category.parent_id ? '↳ ' : ''}
                    {category.name}
                  </span>
                </label>
              ))
            ) : (
              <p className="admin-help">Create a category to group this product.</p>
            )}
          </div>
        </section>
        <div className="admin-save-panel">
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="form-success" role="status">
              {success}
            </p>
          ) : null}
          <button type="submit" disabled={pending || uploads > 0} className="button button-dark">
            <Save size={17} />
            {pending ? 'Saving…' : uploads > 0 ? 'Wait for uploads…' : 'Save product'}
          </button>
          <Link className="text-link" href="/admin/products">
            Back to products
          </Link>
          {initial?.status === 'active' ? (
            <Link
              href={`/product/${initial.slug}`}
              className="text-link"
              target="_blank"
              rel="noreferrer"
            >
              View in shop <ExternalLink size={14} />
            </Link>
          ) : null}
          {initial ? (
            <button
              className="admin-archive-button"
              type="button"
              disabled={pending}
              onClick={() => {
                setError('');
                startTransition(async () => {
                  const result = await saveProductStatus({
                    id: initial.id,
                    status: initial.status === 'active' ? 'inactive' : 'active',
                    expected_updated_at: initial.updated_at,
                  });
                  if (result.error) setError(result.error);
                  else {
                    setStatus(initial.status === 'active' ? 'inactive' : 'active');
                    setSuccess('Visibility updated.');
                    router.refresh();
                  }
                });
              }}
            >
              {initial.status === 'active' ? 'Make inactive' : 'Activate product'}
            </button>
          ) : null}
        </div>
      </aside>
    </form>
  );
}
