import test from 'node:test';
import assert from 'node:assert/strict';
import { productSchema, categorySchema, imageKind, slugify } from '../src/lib/admin-validation.ts';
test('category image updates normalize legacy repeated hyphens and explain invalid slugs', () => {
  const category = {
    id: '279ceefb-164a-490d-8eb1-7047dbd084f2',
    name: 'ARTS & CRAFTS',
    slug: 'arts--crafts',
    parent_id: '86e9b347-918a-4139-b354-5bf8592ff6ff',
    image_url:
      'https://example.supabase.co/storage/v1/object/public/storefront-media/categories/art.webp',
  };
  const parsed = categorySchema.parse(category);
  assert.equal(parsed.slug, 'arts-crafts');
  assert.equal(parsed.id, category.id);
  assert.equal(parsed.parent_id, category.parent_id);
  assert.equal(parsed.image_url, category.image_url);
  assert.equal(
    categorySchema.parse({ ...category, slug: '  ARTS---CRAFTS  ' }).slug,
    'arts-crafts',
  );
  for (const slug of ['arts/crafts', 'arts_crafts', '-arts', 'arts-', 'a']) {
    const result = categorySchema.safeParse({ ...category, slug });
    assert.equal(result.success, false, slug);
    assert.equal(result.error.issues[0].message.includes('pattern'), false);
  }
});
test('admin inputs reject invalid prices, discounts, duplicate options and unsafe image URLs', () => {
  const variant = {
    id: null,
    title: 'Standard',
    sku: 'SKU-1',
    price: 299,
    stock: 3,
    image_url: '',
    hex_code: '',
    is_default: true,
    discount_type: 'none',
    discount_value: 0,
  };
  const product = {
    id: null,
    expected_updated_at: null,
    name: 'Lip balm',
    slug: 'lip-balm',
    brand: 'Test',
    description: '',
    status: 'inactive',
    has_variants: false,
    base_price: 299,
    thumbnail_url: '',
    category_ids: [],
    variants: [variant],
    discount_type: 'none',
    discount_value: 0,
  };
  assert.equal(productSchema.safeParse(product).success, true);
  assert.equal(productSchema.safeParse({ ...product, base_price: 12.345 }).success, false);
  assert.equal(productSchema.safeParse({ ...product, base_price: 12.5 }).success, false);
  assert.equal(
    productSchema.safeParse({ ...product, discount_type: 'amount', discount_value: 10.5 }).success,
    false,
  );
  assert.equal(
    productSchema.safeParse({ ...product, discount_type: 'percentage', discount_value: 12.5 })
      .success,
    true,
  );
  assert.equal(
    productSchema.safeParse({ ...product, discount_type: 'percentage', discount_value: 101 })
      .success,
    false,
  );
  assert.equal(
    productSchema.safeParse({ ...product, thumbnail_url: 'javascript:alert(1)' }).success,
    false,
  );
  assert.equal(
    productSchema.safeParse({ ...product, has_variants: true, variants: [variant, variant] })
      .success,
    false,
  );
  assert.equal(
    productSchema.safeParse({ ...product, variants: [{ ...variant, stock: -1 }] }).success,
    false,
  );
  const id = '11111111-1111-4111-8111-111111111111';
  assert.equal(
    categorySchema.safeParse({
      id,
      name: 'Category',
      slug: 'category',
      parent_id: id,
      image_url: '',
    }).success,
    false,
  );
  assert.equal(slugify('Pretty things & nice notes!'), 'pretty-things-nice-notes');
});
test('image upload validation checks file bytes and rejects SVG/HTML content', () => {
  assert.equal(imageKind(new TextEncoder().encode('<svg>not a bitmap</svg>')), null);
  assert.equal(imageKind(new Uint8Array([0xff, 0xd8, 0xff, 0x00])).mime, 'image/jpeg');
  assert.equal(
    imageKind(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])).mime,
    'image/png',
  );
  assert.equal(imageKind(new TextEncoder().encode('RIFF0000WEBP')).mime, 'image/webp');
});
