'use client';
import Link from 'next/link';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { useShop } from './shop-provider';
import { ProductImage } from './product-card';
import { money } from '@/lib/commerce';
export function Bag() {
  const { lines, items, products, total, update } = useShop();
  const unavailableItems = items.filter(
    (item) => !lines.some((line) => line.variantId === item.variantId),
  );
  const checkoutBlocked =
    unavailableItems.length > 0 || lines.some((line) => line.quantity > line.variant.stock);
  const checkoutButton = checkoutBlocked ? (
    <button type="button" className="button button-dark" disabled>
      Continue to checkout <ArrowRight size={17} />
    </button>
  ) : (
    <Link href="/checkout" className="button button-dark">
      Continue to checkout <ArrowRight size={17} />
    </Link>
  );
  return (
    <>
      <div className="section-heading">
        <h1>Your bag</h1>
        <Link className="text-link" href="/shop">
          Keep shopping <ArrowRight size={17} />
        </Link>
      </div>
      {items.length ? (
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
                    {line.variant.stock <= 0 ? (
                      <p className="bag-stock-status" role="status">
                        Out of stock
                      </p>
                    ) : line.quantity > line.variant.stock ? (
                      <p className="bag-stock-status" role="status">
                        Only {line.variant.stock} available
                      </p>
                    ) : null}
                    <div className="bag-item-controls">
                      <div className="quantity-control">
                        <button
                          disabled={line.variant.stock <= 0}
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
              {unavailableItems.map((item) => {
                const product = products.find((product) => product.id === item.productId);
                const name = product?.name ?? 'Unavailable item';
                return (
                  <article className="bag-item" key={item.variantId}>
                    <div className="bag-photo">
                      <ProductImage src={product?.thumbnail_url ?? null} alt={name} />
                    </div>
                    <div className="bag-item-info">
                      <h2>{name}</h2>
                      <p className="bag-stock-status" role="status">
                        No longer available
                      </p>
                      <div className="bag-item-controls">
                        <button
                          className="remove-item"
                          aria-label={`Remove ${name}`}
                          onClick={() => update(item.variantId, 0)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
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
              {checkoutButton}
            </aside>
          </div>
          <div className="bag-checkout-dock">
            <div>
              <span>Subtotal</span>
              <strong>{money(total)}</strong>
            </div>
            {checkoutButton}
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
