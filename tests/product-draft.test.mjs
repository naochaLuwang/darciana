import test from 'node:test';
import assert from 'node:assert/strict';
import { createDraftVariant, variantFromDraft } from '../src/lib/product-draft.ts';

test('new options carry unique, stable SKUs without manual entry', () => {
  const first = createDraftVariant('initial');
  const second = createDraftVariant();
  assert.match(first.sku, /^DA-[0-9A-F-]{36}$/);
  assert.notEqual(first.sku, second.sku);
  assert.equal(
    variantFromDraft({ ...first, title: 'Rose', price: '150', stock: '3' }).sku,
    first.sku,
  );
});

test('draft conversion preserves existing SKUs and rounds rupees while keeping percentage precision', () => {
  const draft = {
    ...createDraftVariant(),
    sku: 'EXISTING-SKU',
    price: '149.5',
    stock: '4',
    discount_type: 'amount',
    discount_value: '19.5',
  };
  const saved = variantFromDraft(draft);
  assert.equal(saved.sku, 'EXISTING-SKU');
  assert.equal(saved.price, 150);
  assert.equal(saved.stock, 4);
  assert.equal(saved.discount_value, 20);
  assert.equal('key' in saved, false);
  assert.equal(
    variantFromDraft({ ...draft, discount_type: 'percentage', discount_value: '12.5' })
      .discount_value,
    12.5,
  );
  assert.equal(variantFromDraft({ ...draft, discount_type: 'none' }).discount_value, 0);
});
