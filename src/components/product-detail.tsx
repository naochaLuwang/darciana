'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Heart, Minus, Plus, ShoppingBag, Check, Package } from 'lucide-react';
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
  const variant = product.product_variants.find((variant) => variant.id === selectedId);
  const price = variant ? variantPrice(product, variant) : roundRupees(product.base_price ?? 0);
  const originalValue = product.has_variants ? variant?.price : product.base_price;
  const original = originalValue == null ? null : roundRupees(originalValue);
  const stock = variant?.stock ?? 0;
  const images = productGallery(product, variant, media);
  const label = `${product.name}${product.has_variants && variant ? ` · ${variant.title.trim()}` : ''}`;
  return (
    <section className="product-detail">
      <ProductGallery
        key={product.has_variants ? (variant?.id ?? product.id) : product.id}
        images={images}
        label={label}
        variant={product.has_variants}
        error={mediaError}
      />
      <div className="detail-copy">
        {product.brand ? <span className="eyebrow">{product.brand}</span> : null}
        <h1>{product.name}</h1>
        <div className="detail-price">
          {money(price)}
          {original && original > price ? <del>{money(original)}</del> : null}
        </div>
        <p className="tax-note">Taxes included</p>
        <p className={`stock-label ${stock > 0 ? '' : 'muted'}`}>
          <span />
          {stock > 0 ? `In stock${stock < 6 ? ` · Only ${stock} left` : ''}` : 'Sold out'}
        </p>
        {product.has_variants ? (
          <fieldset className="variant-options">
            <legend>Choose an option</legend>
            {product.product_variants.map((option) => (
              <button
                key={option.id}
                type="button"
                className={variant?.id === option.id ? 'selected' : ''}
                aria-pressed={variant?.id === option.id}
                onClick={() => {
                  setSelectedId(option.id);
                  setQuantity(1);
                  setAdded(false);
                }}
              >
                {option.hex_code && /^#[0-9a-f]{6}$/i.test(option.hex_code) ? (
                  <span className="swatch" style={{ background: option.hex_code }} />
                ) : null}
                {option.title}
                {option.stock <= 0 ? ' · Sold out' : ''}
              </button>
            ))}
          </fieldset>
        ) : null}
        <div className="detail-buy">
          <div className="quantity-control">
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
          <button
            className="button button-dark"
            disabled={!variant || stock <= 0}
            onClick={() => {
              if (variant && add(product.id, variant.id, quantity)) setAdded(true);
            }}
          >
            {added ? (
              <>
                <Check size={17} /> Added to bag
              </>
            ) : (
              <>
                <ShoppingBag size={17} /> Add to bag
              </>
            )}
          </button>
          <button
            className={`detail-save ${saved.includes(product.id) ? 'is-saved' : ''}`}
            aria-label="Save product"
            aria-pressed={saved.includes(product.id)}
            onClick={() => toggleSaved(product.id)}
          >
            <Heart size={20} fill={saved.includes(product.id) ? 'currentColor' : 'none'} />
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
