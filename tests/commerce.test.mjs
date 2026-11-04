import test from 'node:test';
import assert from 'node:assert/strict';
import {
  discountedPrice,
  variantPrice,
  parseCart,
  resolveCart,
  categoryTreeIds,
} from '../src/lib/commerce.ts';
import { checkoutSchema } from '../src/lib/checkout.ts';

test('discounts handle fixed, percentage, rounding, and discounts over the price', () => {
  assert.equal(discountedPrice(399, 'amount', 100), 299);
  assert.equal(discountedPrice(999, 'percentage', 50), 499.5);
  assert.equal(discountedPrice(199.99, 'percentage', 15), 169.99);
  assert.equal(discountedPrice(100, 'amount', 150), 0);
  assert.equal(discountedPrice(100, 'percentage', 200), 0);
  assert.equal(discountedPrice(100, 'amount', -50), 100);
});
test('simple product and variant product use the correct price source', () => {
  const product = {
    base_price: 399,
    has_variants: false,
    discount_type: 'amount',
    discount_value: 100,
  };
  const variant = { price: 450, discount_type: 'percentage', discount_value: 20 };
  assert.equal(variantPrice(product, variant), 299);
  assert.equal(variantPrice({ ...product, has_variants: true }, variant), 360);
});
test('corrupt or modified saved carts cannot inject duplicate or invalid quantities', () => {
  assert.deepEqual(parseCart(null), []);
  assert.deepEqual(
    parseCart([
      { productId: 'p', variantId: 'v', quantity: 2 },
      { productId: 'p', variantId: 'v', quantity: 2 },
      { productId: 'q', variantId: 'w', quantity: -1 },
      { productId: 'q', variantId: 'z', quantity: 1.5 },
    ]),
    [{ productId: 'p', variantId: 'v', quantity: 2 }],
  );
  assert.deepEqual(
    resolveCart([{ productId: 'missing', variantId: 'missing', quantity: 1 }], []),
    [],
  );
});
test('category filtering includes grandchildren and terminates on malformed cycles', () => {
  const categories = [
    { id: 'a', parent_id: 'c' },
    { id: 'b', parent_id: 'a' },
    { id: 'c', parent_id: 'b' },
  ];
  assert.deepEqual(categoryTreeIds(categories, 'a'), ['a', 'b', 'c']);
});
test('checkout validates India delivery details, duplicate variants and client input', () => {
  const item = {
    productId: '11111111-1111-4111-8111-111111111111',
    variantId: '22222222-2222-4222-8222-222222222222',
    quantity: 1,
  };
  const input = {
    requestId: '33333333-3333-4333-8333-333333333333',
    items: [item],
    expectedTotal: 299,
    shippingAreaId: '44444444-4444-4444-8444-444444444444',
    expectedShippingPrice: 0,
    paymentMode: 'cash_on_delivery',
    termsAccepted: true,
    shipping: {
      name: 'Test Customer',
      phone: '9876543210',
      address: '12 Example Street',
      city: 'Kolkata',
      state: 'West Bengal',
      pincode: '700001',
      notes: '',
    },
  };
  assert.equal(checkoutSchema.safeParse(input).success, true);
  assert.equal(checkoutSchema.safeParse({ ...input, paymentMode: 'manual_upi' }).success, false);
  assert.equal(checkoutSchema.safeParse({ ...input, paymentMode: '' }).success, false);
  assert.equal(checkoutSchema.safeParse({ ...input, paymentMode: 'card' }).success, false);
  assert.equal(checkoutSchema.safeParse({ ...input, termsAccepted: false }).success, false);
  assert.equal(checkoutSchema.safeParse({ ...input, termsAccepted: undefined }).success, false);
  assert.equal(checkoutSchema.safeParse({ ...input, items: [item, item] }).success, false);
  assert.equal(
    checkoutSchema.safeParse({ ...input, items: [{ ...item, quantity: 11 }] }).success,
    false,
  );
  assert.equal(checkoutSchema.safeParse({ ...input, expectedTotal: -1 }).success, false);
  assert.equal(
    checkoutSchema.safeParse({ ...input, shipping: { ...input.shipping, pincode: '000000' } })
      .success,
    false,
  );
});
