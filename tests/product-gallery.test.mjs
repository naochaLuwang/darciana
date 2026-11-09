import test from 'node:test';
import assert from 'node:assert/strict';
import { orderedImages, productGallery } from '../src/lib/product-media.ts';

const photo = (id, url, position, alt = null) => ({ id, url, position, alt });
test('gallery photos use stored order, preserve alt text, deduplicate primary images and reject unsafe URLs', () => {
  const images = orderedImages(
    [
      photo('c', 'https://example.com/detail.jpg', 2),
      photo('b', 'https://example.com/back.jpg', 1, ' Back view '),
      photo('a', 'https://example.com/front.jpg', 0),
      photo('d', 'https://example.com/front.jpg', 3),
      photo('e', 'javascript:alert(1)', 4),
      photo('f', ' ', 5),
      photo('g', 'https://example.com/last.jpg', null),
    ],
    'https://example.com/front.jpg',
  );
  assert.deepEqual(images, [
    { url: 'https://example.com/front.jpg', alt: null },
    { url: 'https://example.com/back.jpg', alt: 'Back view' },
    { url: 'https://example.com/detail.jpg', alt: null },
    { url: 'https://example.com/last.jpg', alt: null },
  ]);
});

test('simple products combine their full gallery with legacy product and standard-option photos', () => {
  const option = { id: 'standard', image_url: 'https://example.com/standard.jpg' };
  const product = {
    has_variants: false,
    thumbnail_url: 'https://example.com/front.jpg',
    product_variants: [option],
  };
  const media = {
    images: [photo('2', 'https://example.com/back.jpg', 1), photo('1', product.thumbnail_url, 0)],
    variants: { standard: [photo('3', 'https://example.com/standard.jpg', 0)] },
  };
  assert.deepEqual(
    productGallery(product, option, media).map((image) => image.url),
    [
      'https://example.com/front.jpg',
      'https://example.com/back.jpg',
      'https://example.com/standard.jpg',
    ],
  );
});

test('variant galleries never fall back to product-wide or another option’s photos', () => {
  const rose = { id: 'rose', image_url: 'https://example.com/rose-front.jpg' };
  const mint = { id: 'mint', image_url: 'https://example.com/mint-front.jpg' };
  const missing = { id: 'missing', image_url: null };
  const product = {
    has_variants: true,
    thumbnail_url: 'https://example.com/shared.jpg',
    product_variants: [rose, mint, missing],
  };
  const media = {
    images: [photo('product', product.thumbnail_url, 0)],
    variants: {
      rose: [photo('r2', 'https://example.com/rose-back.jpg', 1), photo('r1', rose.image_url, 0)],
      mint: [photo('m1', mint.image_url, 0)],
    },
  };
  assert.deepEqual(
    productGallery(product, rose, media).map((image) => image.url),
    [rose.image_url, 'https://example.com/rose-back.jpg'],
  );
  assert.deepEqual(
    productGallery(product, mint, media).map((image) => image.url),
    [mint.image_url],
  );
  assert.deepEqual(productGallery(product, missing, media), []);
  assert.deepEqual(productGallery(product, undefined, media), []);
  assert.deepEqual(productGallery(product, rose, null), [{ url: rose.image_url, alt: null }]);
  assert.deepEqual(productGallery(product, missing, null), []);
});
