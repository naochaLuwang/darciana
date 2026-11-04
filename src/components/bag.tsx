'use client';
import Link from 'next/link';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { useShop } from './shop-provider';
import { ProductImage } from './product-card';
import { money } from '@/lib/commerce';
export function Bag() {
  const { lines, items, total, update } = useShop();
  return (
    <>
      <div className="section-heading">
        <h1>Your bag</h1>
        <Link className="text-link" href="/shop">
          Keep shopping <ArrowRight size={17} />
        </Link>
      </div>
      {items.length > lines.length ? (
        <div className="notice" role="alert">
          Some items are no longer available.{' '}
          <button
            className="text-link"
            onClick={() =>
              items
                .filter((item) => !lines.some((line) => line.variantId === item.variantId))
                .forEach((item) => update(item.variantId, 0))
            }
          >
            Remove unavailable items
          </button>
        </div>
      ) : null}
      {lines.length ? (
        <>
          <div className="bag-layout">
            <div className="bag-lines">
              {lines.map((line) => (
                <article className="bag-item" key={line.variantId}>
                  <Link href={`/product/${line.product.slug}`} className="bag-photo">
                    <ProductImage
                      src={line.variant.image_url || line.product.thumbnail_url}
                      alt={line.product.name}
                    />
                  </Link>
                  <div className="bag-item-info">
                    <span className="little-label">{line.product.brand}</span>
                    <h2>
                      <Link href={`/product/${line.product.slug}`}>{line.product.name}</Link>
                    </h2>
                    {line.product.has_variants ? <p>{line.variant.title}</p> : null}
                    <span>{money(line.price)}</span>
                    {line.quantity > line.variant.stock ? (
                      <p className="form-error">
                        Only {line.variant.stock} available. Reduce the quantity or remove this
                        item.
                      </p>
                    ) : null}
                    <div className="bag-item-controls">
                      <div className="quantity-control">
                        <button
                          aria-label={`Decrease ${line.product.name} quantity`}
                          onClick={() => update(line.variantId, line.quantity - 1)}
                        >
                          <Minus size={13} />
                        </button>
                        <span>{line.quantity}</span>
                        <button
                          disabled={line.quantity >= Math.min(10, line.variant.stock)}
                          aria-label={`Increase ${line.product.name} quantity`}
                          onClick={() => update(line.variantId, line.quantity + 1)}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                      <button
                        className="remove-item"
                        aria-label={`Remove ${line.product.name}`}
                        onClick={() => update(line.variantId, 0)}
                      >
                        <Trash2 size={16} />
                      </button>
                      <strong>{money(line.price * line.quantity)}</strong>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <aside className="order-summary">
              <h2>Order summary</h2>
              <div>
                <span>Delivery</span>
                <span>At checkout</span>
              </div>
              <div className="summary-total">
                <strong>Subtotal</strong>
                <strong>{money(total)}</strong>
              </div>
              <Link href="/checkout" className="button button-dark">
                Continue to checkout <ArrowRight size={17} />
              </Link>
            </aside>
          </div>
          <div className="bag-checkout-dock">
            <div>
              <span>Subtotal</span>
              <strong>{money(total)}</strong>
            </div>
            <Link href="/checkout" className="button button-dark">
              Continue to checkout <ArrowRight size={17} />
            </Link>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <ShoppingBag size={38} strokeWidth={1.2} />
          <h2>Your bag is empty</h2>
          <Link href="/shop" className="button button-dark">
            Shop products <ArrowRight size={17} />
          </Link>
        </div>
      )}
    </>
  );
}
