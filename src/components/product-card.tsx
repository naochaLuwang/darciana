'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Heart, ArrowUpRight } from 'lucide-react';
import { money, startingPrice, type Product } from '@/lib/commerce';
import { useShop } from './shop-provider';
export function ProductImage({
  src,
  alt,
  priority = false,
  className = '',
  eager = false,
}: {
  src: string | null;
  alt: string;
  priority?: boolean;
  className?: string;
  eager?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return src && src !== failedSrc ? (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 600px) 48vw, (max-width: 900px) 33vw, 25vw"
      className={`object-contain ${className}`}
      priority={priority}
      loading={priority || eager ? 'eager' : 'lazy'}
      unoptimized
      onError={() => setFailedSrc(src)}
    />
  ) : (
    <span className="image-placeholder" aria-label="Product image unavailable">
      d<span>✳</span>
    </span>
  );
}
export function ProductCard({
  product,
  index = 0,
  eager = false,
}: {
  product: Product;
  index?: number;
  eager?: boolean;
}) {
  const { saved, toggleSaved } = useShop();
  const price = startingPrice(product);
  const inStock = product.product_variants.some((variant) => variant.stock > 0);
  const original = product.has_variants ? null : product.base_price;
  return (
    <article className="product-card">
      <div className={`product-photo tint-${index % 4}`}>
        <Link href={`/product/${product.slug}`} aria-label={`View ${product.name}`}>
          <ProductImage src={product.thumbnail_url} alt={product.name} eager={eager} />
        </Link>
        <button
          className={`save-button ${saved.includes(product.id) ? 'is-saved' : ''}`}
          aria-label={`${saved.includes(product.id) ? 'Unsave' : 'Save'} ${product.name}`}
          aria-pressed={saved.includes(product.id)}
          onClick={() => toggleSaved(product.id)}
        >
          <Heart size={17} fill={saved.includes(product.id) ? 'currentColor' : 'none'} />
        </button>
        {!inStock ? (
          <span className="product-tag">Sold out</span>
        ) : original && original > price ? (
          <span className="product-tag">{Math.round((1 - price / original) * 100)}% off</span>
        ) : null}
        <Link className="product-view" href={`/product/${product.slug}`}>
          View product <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className="product-meta">
        {product.brand ? <span>{product.brand}</span> : null}
        <h3>
          <Link href={`/product/${product.slug}`}>{product.name}</Link>
        </h3>
        <p>
          {product.has_variants ? <span className="from">From </span> : null}
          {money(price)}
          {original && original > price ? <del>{money(original)}</del> : null}
        </p>
        {product.has_variants ? (
          <span className="product-options">{product.product_variants.length} options</span>
        ) : null}
      </div>
    </article>
  );
}
