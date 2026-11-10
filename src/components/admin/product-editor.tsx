'use client';
import Link from 'next/link';
import {
  cloneElement,
  useId,
  useState,
  useTransition,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Save, ExternalLink } from 'lucide-react';
import { saveProduct, saveProductStatus } from '@/app/admin/actions';
import { slugify } from '@/lib/admin-validation';
import type { AdminProduct } from '@/lib/admin';
import type { Category } from '@/lib/commerce';
import { ImageField } from './image-field';
import { roundRupees } from '@/lib/money';

import { createDraftVariant, variantFromDraft, type DraftVariant } from '@/lib/product-draft';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldError } from '@/components/ui/field';

// SSR controls stay disabled until their client event handlers are available.
const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

function ProductField({
  label,
  description,
  children,
}: {
  label: string;
  description?: ReactNode;
  children: ReactElement<{ id?: string; 'aria-describedby'?: string }>;
}) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {cloneElement(children, { id, 'aria-describedby': description ? `${id}-hint` : undefined })}
      {description ? <FieldDescription id={`${id}-hint`}>{description}</FieldDescription> : null}
    </Field>
  );
}

export function ProductEditor({
  initial,
  categories,
}: {
  initial?: AdminProduct;
  categories: Category[];
}) {
  const router = useRouter();
  const ready = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
  const fieldId = useId();
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
      ? String(roundRupees(initial.discount_value))
      : String(initial?.discount_value ?? ''),
  );
  const [image, setImage] = useState(initial?.thumbnail_url ?? '');
  const [categoryIds, setCategoryIds] = useState(initial?.categoryIds ?? []);
  const [variants, setVariants] = useState<DraftVariant[]>(() =>
    initial?.product_variants.length
      ? initial.product_variants.map((variant) => ({
          ...variant,
          price: String(roundRupees(variant.price)),
          stock: String(variant.stock),
          discount_value:
            variant.discount_type === 'amount'
              ? String(roundRupees(variant.discount_value))
              : String(variant.discount_value),
          key: variant.id,
          image_url: variant.image_url ?? '',
          hex_code: variant.hex_code ?? '',
          discount_type: variant.discount_type as DraftVariant['discount_type'],
        }))
      : [createDraftVariant('initial')],
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
      discount_value:
        hasVariants || discountType === 'none'
          ? 0
          : discountType === 'amount'
            ? roundRupees(Number(discountValue))
            : Number(discountValue),
      variants: variants.map((draft) => {
        const variant = variantFromDraft(draft);
        return {
          ...variant,
          price: hasVariants ? variant.price : basePriceAmount,
          discount_type: hasVariants ? variant.discount_type : discountType,
          discount_value: hasVariants
            ? variant.discount_type === 'none'
              ? 0
              : variant.discount_value
            : discountType === 'none'
              ? 0
              : discountType === 'amount'
                ? roundRupees(Number(discountValue))
                : Number(discountValue),
        };
      }),
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
      className="admin-product-form"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <fieldset disabled={!ready} className="admin-editor min-w-0 w-full">
        <div className="admin-editor-main">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>
                <h2>Product details</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <ProductField label="Product name">
                  <Input
                    required
                    maxLength={500}
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      if (!slugEdited) setSlug(slugify(event.target.value));
                    }}
                  />
                </ProductField>
                <div className="grid min-w-0 gap-5 sm:grid-cols-2">
                  <ProductField
                    label="URL slug"
                    description="Changing a slug changes the product link."
                  >
                    <Input
                      required
                      value={slug}
                      maxLength={600}
                      onChange={(event) => {
                        setSlugEdited(true);
                        setSlug(event.target.value);
                      }}
                    />
                  </ProductField>
                  <ProductField label="Brand">
                    <Input
                      value={brand}
                      maxLength={100}
                      onChange={(event) => setBrand(event.target.value)}
                    />
                  </ProductField>
                </div>
                <ProductField label="Description">
                  <Textarea
                    className="min-h-32"
                    rows={7}
                    value={description}
                    maxLength={20000}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </ProductField>
                <ImageField
                  label="Product image"
                  value={image}
                  onChange={setImage}
                  onBusy={trackUpload}
                />
              </FieldGroup>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>
                <h2>Price & options</h2>
              </CardTitle>
              <CardDescription>Prices in INR, including applicable taxes.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field orientation="horizontal" className="min-h-11">
                  <Checkbox
                    id={`${fieldId}-options`}
                    checked={hasVariants}
                    disabled={variants.length > 1}
                    onCheckedChange={(checked) => setHasVariants(checked === true)}
                  />
                  <FieldLabel htmlFor={`${fieldId}-options`}>
                    This product has multiple options
                  </FieldLabel>
                </Field>
                {!hasVariants ? (
                  <div className="grid min-w-0 gap-5 sm:grid-cols-2">
                    <ProductField label="Base price (₹)">
                      <Input
                        className="h-11"
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
                    </ProductField>
                    <ProductField label="Discount">
                      <NativeSelect
                        value={discountType}
                        onChange={(event) => {
                          setDiscountType(event.target.value);
                          setDiscountValue('');
                        }}
                      >
                        <NativeSelectOption value="none">No discount</NativeSelectOption>
                        <NativeSelectOption value="amount">Amount off (₹)</NativeSelectOption>
                        <NativeSelectOption value="percentage">
                          Percentage off (%)
                        </NativeSelectOption>
                      </NativeSelect>
                    </ProductField>
                    {discountType !== 'none' ? (
                      <ProductField label="Discount value">
                        <Input
                          className="h-11"
                          type="number"
                          required
                          min="0"
                          step={discountType === 'percentage' ? '0.01' : '1'}
                          max={discountType === 'percentage' ? 100 : basePrice}
                          value={discountValue}
                          onChange={(event) => setDiscountValue(event.target.value)}
                          onBlur={(event) => {
                            if (discountType === 'amount' && event.currentTarget.value !== '')
                              setDiscountValue(
                                String(roundRupees(Number(event.currentTarget.value))),
                              );
                          }}
                        />
                      </ProductField>
                    ) : null}
                  </div>
                ) : null}
                <RadioGroup
                  role={hasVariants ? 'radiogroup' : 'group'}
                  aria-label={hasVariants ? 'Default product option' : 'Stock details'}
                  value={variants.find((variant) => variant.is_default)?.key}
                  onValueChange={(key) =>
                    setVariants((variants) =>
                      variants.map((variant) => ({ ...variant, is_default: variant.key === key })),
                    )
                  }
                >
                  {variants.map((variant, index) => (
                    <div
                      className="space-y-5 rounded-lg border border-border bg-accent/30 p-4 sm:p-5"
                      key={variant.key}
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <h3>{hasVariants ? `Option ${index + 1}` : 'Stock details'}</h3>
                        {hasVariants ? (
                          <Field orientation="horizontal" className="ml-auto min-h-11 w-auto">
                            <RadioGroupItem
                              aria-label={`Option ${index + 1} default`}
                              id={`${fieldId}-${variant.key}-default`}
                              value={variant.key}
                            />
                            <FieldLabel htmlFor={`${fieldId}-${variant.key}-default`}>
                              Default
                            </FieldLabel>
                          </Field>
                        ) : null}
                        {!variant.id && index > 0 ? (
                          <Button
                            variant="ghost"
                            size="sm"
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
                          </Button>
                        ) : null}
                      </div>
                      <div className="grid min-w-0 gap-5 sm:grid-cols-2">
                        {hasVariants ? (
                          <ProductField label="Option name">
                            <Input
                              aria-label={`Option ${index + 1} name`}
                              value={variant.title}
                              required
                              maxLength={200}
                              onChange={(event) =>
                                patchVariant(index, { title: event.target.value })
                              }
                            />
                          </ProductField>
                        ) : null}
                        {initial ? (
                          <ProductField label="SKU">
                            <Input
                              aria-label={`Option ${index + 1} SKU`}
                              value={variant.sku}
                              required
                              maxLength={1000}
                              onChange={(event) => patchVariant(index, { sku: event.target.value })}
                            />
                          </ProductField>
                        ) : null}
                        <ProductField label="Stock">
                          <Input
                            aria-label={`Option ${index + 1} stock`}
                            className="h-11"
                            type="number"
                            min="0"
                            max="1000000"
                            step="1"
                            required
                            value={variant.stock}
                            onChange={(event) => patchVariant(index, { stock: event.target.value })}
                          />
                        </ProductField>
                        {hasVariants ? (
                          <>
                            <ProductField label="Price (₹)">
                              <Input
                                aria-label={`Option ${index + 1} price`}
                                className="h-11"
                                type="number"
                                min="0"
                                max="1000000"
                                step="1"
                                required
                                value={variant.price}
                                onChange={(event) =>
                                  patchVariant(index, { price: event.target.value })
                                }
                                onBlur={(event) =>
                                  patchVariant(index, {
                                    price:
                                      event.currentTarget.value === ''
                                        ? ''
                                        : String(roundRupees(Number(event.currentTarget.value))),
                                  })
                                }
                              />
                            </ProductField>
                            <ProductField label="Discount">
                              <NativeSelect
                                value={variant.discount_type}
                                onChange={(event) =>
                                  patchVariant(index, {
                                    discount_type: event.target
                                      .value as DraftVariant['discount_type'],
                                    discount_value: '',
                                  })
                                }
                              >
                                <NativeSelectOption value="none">No discount</NativeSelectOption>
                                <NativeSelectOption value="amount">
                                  Amount off (₹)
                                </NativeSelectOption>
                                <NativeSelectOption value="percentage">
                                  Percentage off (%)
                                </NativeSelectOption>
                              </NativeSelect>
                            </ProductField>
                            {variant.discount_type !== 'none' ? (
                              <ProductField label="Discount value">
                                <Input
                                  className="h-11"
                                  type="number"
                                  min="0"
                                  step={variant.discount_type === 'percentage' ? '0.01' : '1'}
                                  required
                                  max={variant.discount_type === 'percentage' ? 100 : variant.price}
                                  value={variant.discount_value}
                                  onChange={(event) =>
                                    patchVariant(index, { discount_value: event.target.value })
                                  }
                                  onBlur={(event) => {
                                    if (
                                      variant.discount_type === 'amount' &&
                                      event.currentTarget.value !== ''
                                    )
                                      patchVariant(index, {
                                        discount_value: String(
                                          roundRupees(Number(event.currentTarget.value)),
                                        ),
                                      });
                                  }}
                                />
                              </ProductField>
                            ) : null}
                            <ProductField label="Colour hex (optional)">
                              <Input
                                value={variant.hex_code}
                                placeholder="#a58bb6"
                                onChange={(event) =>
                                  patchVariant(index, { hex_code: event.target.value })
                                }
                              />
                            </ProductField>
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
                </RadioGroup>
                {hasVariants ? (
                  <Button
                    variant="outline"
                    className="h-11 w-fit"
                    type="button"
                    disabled={variants.length >= 100}
                    onClick={() =>
                      setVariants((variants) => [
                        ...variants,
                        { ...createDraftVariant(), title: '', is_default: false },
                      ])
                    }
                  >
                    <Plus size={16} />
                    Add option
                  </Button>
                ) : null}
                {initial ? (
                  <FieldDescription>
                    Keep existing options for order history. Set unused options to zero stock.
                  </FieldDescription>
                ) : null}
              </FieldGroup>
            </CardContent>
          </Card>
        </div>
        <aside className="admin-editor-aside">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>
                <h2>Visibility</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <ProductField label="Status">
                  <NativeSelect
                    value={status}
                    onChange={(event) => setStatus(event.target.value as 'active' | 'inactive')}
                  >
                    <NativeSelectOption value="inactive">
                      Inactive — hidden from shop
                    </NativeSelectOption>
                    <NativeSelectOption value="active">Active — visible in shop</NativeSelectOption>
                  </NativeSelect>
                </ProductField>
                <FieldDescription>Inactive products are hidden from customers.</FieldDescription>
              </FieldGroup>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>
                <h2>Categories</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {categories.length ? (
                  categories.map((category) => (
                    <Field
                      key={category.id}
                      orientation="horizontal"
                      className={category.parent_id ? 'min-h-11 pl-5' : 'min-h-11'}
                    >
                      <Checkbox
                        id={`${fieldId}-category-${category.id}`}
                        checked={categoryIds.includes(category.id)}
                        onCheckedChange={(checked) =>
                          setCategoryIds((ids) =>
                            checked === true
                              ? [...ids, category.id]
                              : ids.filter((id) => id !== category.id),
                          )
                        }
                      />
                      <FieldLabel htmlFor={`${fieldId}-category-${category.id}`}>
                        {category.name}
                      </FieldLabel>
                    </Field>
                  ))
                ) : (
                  <p className="admin-help">Create a category to group this product.</p>
                )}
              </div>
            </CardContent>
          </Card>
          <div className="admin-save-panel">
            {error ? <FieldError>{error}</FieldError> : null}
            {success ? (
              <p className="form-success" role="status">
                {success}
              </p>
            ) : null}
            <Button type="submit" disabled={pending || uploads > 0} className="h-11 w-full">
              <Save size={17} />
              {pending ? 'Saving…' : uploads > 0 ? 'Wait for uploads…' : 'Save product'}
            </Button>
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
              <Button
                variant="outline"
                className="h-11 w-full"
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
              </Button>
            ) : null}
          </div>
        </aside>
      </fieldset>
    </form>
  );
}
