'use client';
import { useId, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Heart,
  Minus,
  Plus,
  ShoppingBag,
  Check,
  Package,
  PackageX,
  ArrowRight,
} from 'lucide-react';
import { money, roundRupees, variantPrice, type Product } from '@/lib/commerce';
import { ProductGallery } from './product-gallery';
import { productGallery, type ProductMedia } from '@/lib/product-media';
import { useShop } from './shop-provider';
export function ProductDetail({
  product,
  media = null,
  mediaError,
}: {
  product: Product;
  media?: ProductMedia | null;
  mediaError?: string | null;
}) {
  const { add, saved, toggleSaved } = useShop();
  const [selectedId, setSelectedId] = useState(
    product.product_variants.find((variant) => variant.stock > 0 && variant.is_default)?.id ??
      product.product_variants.find((variant) => variant.stock > 0)?.id ??
      product.product_variants[0]?.id,
  );
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const options = useRef<HTMLFieldSetElement>(null);
  const optionsId = useId();
  const availabilityId = useId();
  const variant = product.product_variants.find((variant) => variant.id === selectedId);
  const price = variant ? variantPrice(product, variant) : roundRupees(product.base_price ?? 0);
  const originalValue = product.has_variants ? variant?.price : product.base_price;
  const original = originalValue == null ? null : roundRupees(originalValue);
  const stock = variant?.stock ?? 0;
  const available = !!variant && stock > 0;
  const anotherOption =
    product.has_variants &&
    !available &&
    product.product_variants.some((option) => option.stock > 0);
  const availability = available
    ? stock < 6
      ? `In stock · ${stock} left`
      : 'In stock'
    : anotherOption
      ? 'This option is out of stock'
      : 'Out of stock';
  const images = productGallery(product, variant, media);
  const label = `${product.name}${product.has_variants && variant ? ` · ${variant.title.trim()}` : ''}`;
  return (
    <section className="product-detail">
      <div className="detail-media">
        <ProductGallery
          key={product.has_variants ? (variant?.id ?? product.id) : product.id}
          images={images}
          label={label}
          variant={product.has_variants}
          error={mediaError}
        />
        <button
          type="button"
          className={`detail-save ${saved.includes(product.id) ? 'is-saved' : ''}`}
          aria-label="Save product"
          aria-pressed={saved.includes(product.id)}
          onClick={() => toggleSaved(product.id)}
        >
          <Heart size={20} fill={saved.includes(product.id) ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="detail-copy">
        {product.brand ? <p className="detail-brand">{product.brand}</p> : null}
        <h1>{product.name}</h1>
        <div className="detail-price-row">
          <div>
            <div className="detail-price">
              {money(price)}
              {original && original > price ? <del>{money(original)}</del> : null}
            </div>
            <p className="tax-note">Taxes included</p>
          </div>
          <p
            id={availabilityId}
            className={`detail-availability ${available ? 'is-available' : 'is-unavailable'}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {available ? (
              <Check size={14} aria-hidden="true" />
            ) : (
              <PackageX size={15} aria-hidden="true" />
            )}
            {availability}
          </p>
        </div>
        {product.has_variants ? (
          <fieldset ref={options} id={optionsId} className="variant-options">
            <legend>Choose an option</legend>
            {product.product_variants.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`${variant?.id === option.id ? 'selected' : ''} ${option.stock <= 0 ? 'is-unavailable' : ''}`}
                aria-label={`${option.title}${option.stock <= 0 ? ' · Sold out' : ''}`}
                aria-pressed={variant?.id === option.id}
                data-available={option.stock > 0}
                onClick={() => {
                  setSelectedId(option.id);
                  setQuantity(1);
                  setAdded(false);
                }}
              >
                {option.hex_code && /^#[0-9a-f]{6}$/i.test(option.hex_code) ? (
                  <span
                    className="swatch"
                    style={{ background: option.hex_code }}
                    aria-hidden="true"
                  />
                ) : null}
                <span className="variant-option-copy">
                  <span>{option.title}</span>
                  {option.stock <= 0 ? <small>Sold out</small> : null}
                </span>
              </button>
            ))}
          </fieldset>
        ) : null}
        <div className="detail-buy" role="group" aria-label="Purchase options">
          {available ? (
            <div className="quantity-control" role="group" aria-label="Quantity">
              <button
                aria-label="Decrease quantity"
                disabled={quantity <= 1}
                onClick={() => setQuantity((quantity) => quantity - 1)}
              >
                <Minus size={15} />
              </button>
              <span>{quantity}</span>
              <button
                aria-label="Increase quantity"
                disabled={quantity >= Math.min(10, stock)}
                onClick={() => setQuantity((quantity) => quantity + 1)}
              >
                <Plus size={15} />
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className="button button-dark"
            disabled={!available && !anotherOption}
            aria-describedby={availabilityId}
            aria-controls={anotherOption ? optionsId : undefined}
            onClick={() => {
              if (anotherOption) {
                options.current?.scrollIntoView({
                  block: 'center',
                  behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                    ? 'instant'
                    : 'smooth',
                });
                options.current
                  ?.querySelector<HTMLButtonElement>('button[data-available="true"]')
                  ?.focus({ preventScroll: true });
              } else if (available && variant && add(product.id, variant.id, quantity))
                setAdded(true);
            }}
          >
            {anotherOption ? (
              <>
                Choose another option <ArrowRight size={17} aria-hidden="true" />
              </>
            ) : !available ? (
              <>
                <PackageX size={18} aria-hidden="true" /> Out of stock
              </>
            ) : added ? (
              <>
                <Check size={17} /> Added to bag
              </>
            ) : (
              <>
                <ShoppingBag size={17} /> Add to bag
              </>
            )}
          </button>
        </div>
        {added ? (
          <Link className="text-link bag-confirm" href="/bag">
            View bag →
          </Link>
        ) : null}
        {product.description ? (
          <details className="detail-description">
            <summary>Product details</summary>
            <p>{product.description}</p>
          </details>
        ) : null}
        <div className="detail-delivery">
          <Package size={19} />
          <p>Delivery fee at checkout</p>
        </div>
      </div>
    </section>
  );
}
