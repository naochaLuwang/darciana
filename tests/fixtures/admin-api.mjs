import { createDeleteAccountHandler } from '../../supabase/functions/delete-account/handler.mjs';
// Isolated browser-test API. Never used by the app unless explicitly configured
// by playwright.admin.config.ts. No live Supabase credentials or data are used.
import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { variantPrice } from '../../src/lib/commerce.ts';
export const OWNER = '22222222-2222-4222-8222-222222222222';
export const CUSTOMER = '11111111-1111-4111-8111-111111111111';
export function tokenFor(id) {
  const encode = (data) => Buffer.from(JSON.stringify(data)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: id, role: 'authenticated', aud: 'authenticated', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })}.Zml4dHVyZQ`;
}
export function userFor(id) {
  return {
    id,
    aud: 'authenticated',
    role: 'authenticated',
    email: id === OWNER ? 'owner@example.com' : 'customer@example.com',
    email_confirmed_at: '2026-01-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    app_metadata: { provider: 'email' },
    user_metadata: {},
  };
}
if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  let products,
    categories,
    orders,
    activity,
    areas,
    addresses,
    addressesUnavailable,
    failAddressSave;
  let profiles,
    addressBook,
    deletedUsers,
    siteSettings,
    oauthChallenges,
    oauthDenied,
    galleryUnavailable,
    storageObjects;
  const timestamp = () => new Date().toISOString();
  function reset() {
    storageObjects = new Map();
    oauthChallenges = new Map();
    oauthDenied = false;
    galleryUnavailable = false;
    siteSettings = [
      {
        id: '77777777-7777-4777-8777-777777777771',
        key: 'privacy_policy',
        content: 'Your information is used to process orders.\n\nPrivacy fixture content.',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: '77777777-7777-4777-8777-777777777772',
        key: 'return_policy',
        content: 'Contact the store about returns.',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: '77777777-7777-4777-8777-777777777773',
        key: 'terms_and_conditions',
        content: 'Orders are subject to confirmation.',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ];
    addresses = new Map();
    profiles = new Map();
    addressBook = [];
    deletedUsers = new Set();
    addressesUnavailable = false;
    failAddressSave = false;
    categories = [
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        name: 'Cosmetics',
        slug: 'cosmetics',
        parent_id: null,
        image_url: '',
      },
      {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        name: 'Stationery',
        slug: 'stationery',
        parent_id: null,
        image_url: '',
      },
      {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        name: 'Lip colour',
        slug: 'lip-colour',
        parent_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        image_url: '',
      },
    ];
    products = [
      {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Rose lip tint',
        slug: 'rose-lip-tint',
        brand: 'Darciana test',
        description: 'Fixture product for isolated admin testing.',
        category_id: categories[0].id,
        currency: 'INR',
        has_variants: false,
        base_price: 399,
        status: 'active',
        discount_type: 'amount',
        discount_value: 100,
        thumbnail_url: null,
        created_at: '2026-11-01T12:00:00Z',
        updated_at: '2026-11-01T12:00:00Z',
        product_categories: [{ category_id: categories[0].id }],
        product_variants: [
          {
            id: '44444444-4444-4444-8444-444444444444',
            title: 'Standard',
            sku: 'ROSE-01',
            price: 399,
            stock: 4,
            currency: 'INR',
            image_url: null,
            hex_code: null,
            discount_type: 'amount',
            discount_value: 100,
            is_default: true,
            updated_at: '2026-11-01T12:00:00Z',
          },
        ],
      },
    ];
    orders = [
      {
        id: '55555555-5555-4555-8555-555555555555',
        user_id: CUSTOMER,
        status: 'awaiting_confirmation',
        item_total: 299,
        created_at: '2026-11-02T12:00:00Z',
        items: [{ name: 'Rose lip tint', option: 'Standard', quantity: 1, unit_price: 299 }],
        shipping: {
          name: 'Test Customer',
          phone: '9876543210',
          address: '12 Example Street',
          city: 'Kolkata',
          state: 'West Bengal',
          pincode: '700001',
          notes: 'Test request — not a live order.',
        },
      },
    ];
    activity = [];
    areas = [
      {
        id: 'aaaaaaaa-1111-4111-8111-111111111111',
        name: 'Central Market',
        price: 50,
        is_active: true,
        updated_at: '2026-11-01T12:00:00Z',
      },
      {
        id: 'bbbbbbbb-1111-4111-8111-111111111111',
        name: 'Town Centre',
        price: 0,
        is_active: true,
        updated_at: '2026-11-01T12:00:00Z',
      },
      {
        id: 'cccccccc-1111-4111-8111-111111111111',
        name: 'Hidden Zone',
        price: 100,
        is_active: false,
        updated_at: '2026-11-01T12:00:00Z',
      },
    ];
  }
  reset();
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1:54329');
    const path = url.pathname;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    const reply = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };
    if (req.method === 'OPTIONS') return reply(200, {});
    if (path === '/health') return reply(200, { ok: true });
    if (path === '/__reset') {
      reset();
      return reply(200, {});
    }
    if (path === '/__gallery') {
      const image = (name, position) => ({
        id: `image-${name}`,
        url: `https://images.example.test/${name}.png`,
        position,
        alt: name.replaceAll('-', ' '),
      });
      const simple = products[0];
      simple.thumbnail_url = image('simple-front', 0).url;
      simple.product_images = [
        image('simple-detail', 2),
        image('simple-front', 0),
        image('simple-back', 1),
        { ...image('simple-front', 3), id: 'duplicate-front' },
      ];
      simple.product_variants[0].image_url = simple.thumbnail_url;
      simple.product_variants[0].variant_images = [];
      const makeVariant = (id, title, count) => ({
        ...simple.product_variants[0],
        id,
        title,
        sku: title.toUpperCase(),
        is_default: title === 'Rose',
        image_url: count ? image(`${title.toLowerCase()}-front`, 0).url : null,
        variant_images: count
          ? [
              image(`${title.toLowerCase()}-back`, 1),
              image(`${title.toLowerCase()}-front`, 0),
              ...(count > 2 ? [image(`${title.toLowerCase()}-detail`, 2)] : []),
            ]
          : [],
      });
      products.push({
        ...simple,
        id: '99999999-9999-4999-8999-999999999999',
        name: 'Colour pencil set',
        slug: 'colour-pencil-set',
        has_variants: true,
        base_price: null,
        thumbnail_url: image('shared-product', 0).url,
        product_images: [image('shared-product', 0)],
        product_variants: [
          makeVariant('99999999-9999-4999-8999-999999999991', 'Rose', 2),
          makeVariant('99999999-9999-4999-8999-999999999992', 'Mint', 3),
          makeVariant('99999999-9999-4999-8999-999999999993', 'Sand', 0),
        ],
      });
      return reply(200, {});
    }
    if (path === '/__gallery/unavailable' || path === '/__gallery/available') {
      galleryUnavailable = path.endsWith('/unavailable');
      return reply(200, {});
    }
    if (
      path === '/rest/v1/products' &&
      galleryUnavailable &&
      url.searchParams.get('select')?.includes('product_images')
    )
      return reply(403, { code: '42501', message: 'Gallery fixture unavailable' });
    if (path === '/__areas/empty') {
      areas = [];
      return reply(200, {});
    }
    if (path === '/__areas/disable') {
      areas[0].is_active = false;
      return reply(200, {});
    }
    if (path === '/__address/unavailable') {
      addressesUnavailable = true;
      return reply(200, {});
    }
    if (path === '/__address/fail-save') {
      failAddressSave = true;
      return reply(200, {});
    }
    if (path === '/__oauth/deny') {
      oauthDenied = true;
      return reply(200, {});
    }
    if (path === '/auth/v1/authorize') {
      const redirect = url.searchParams.get('redirect_to');
      if (
        !['http://127.0.0.1:3002/auth/callback', 'http://127.0.0.1:5174/auth/callback'].includes(
          redirect,
        )
      )
        return reply(400, { message: 'Invalid fixture redirect' });
      const callback = new URL(redirect);
      if (
        url.searchParams.get('provider') !== 'google' ||
        url.searchParams.get('redirect_to') !== callback.href ||
        !url.searchParams.get('code_challenge') ||
        url.searchParams.get('code_challenge_method')?.toLowerCase() !== 's256'
      )
        return reply(400, { message: 'Invalid fixture OAuth request' });
      if (oauthDenied) callback.searchParams.set('error', 'access_denied');
      else {
        const code = randomUUID();
        oauthChallenges.set(code, url.searchParams.get('code_challenge'));
        callback.searchParams.set('code', code);
        // The application must ignore arbitrary redirect query parameters.
        callback.searchParams.set('next', 'https://untrusted.example/');
      }
      res.writeHead(302, { Location: callback.href });
      return res.end();
    }
    const token = (req.headers.authorization ?? '').replace('Bearer ', '');
    let user = null;
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
      if ([OWNER, CUSTOMER].includes(payload.sub) && !deletedUsers.has(payload.sub))
        user = userFor(payload.sub);
    } catch {}
    if (path === '/auth/v1/user')
      return user ? reply(200, user) : reply(401, { message: 'Invalid token' });
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const rawBytes = Buffer.concat(chunks);
    const raw = rawBytes.toString('utf8');
    let args = {};
    try {
      args = JSON.parse(raw || '{}');
    } catch {}
    if (path.startsWith('/storage/v1/object/public/storefront-media/')) {
      const key = decodeURIComponent(
        path.slice('/storage/v1/object/public/storefront-media/'.length),
      );
      const object = storageObjects.get(key);
      if (!object) return reply(404, { message: 'Image not found' });
      res.writeHead(200, { 'Content-Type': object.contentType });
      return res.end(object.bytes);
    }
    if (path.startsWith('/storage/v1/object/storefront-media/') && req.method === 'POST') {
      if (user?.id !== OWNER) return reply(403, { message: 'Denied' });
      const key = decodeURIComponent(path.slice('/storage/v1/object/storefront-media/'.length));
      if (storageObjects.has(key)) return reply(409, { message: 'Already exists' });
      storageObjects.set(key, { bytes: rawBytes, contentType: req.headers['content-type'] });
      return reply(200, { Id: randomUUID(), Key: `storefront-media/${key}` });
    }
    if (path === '/functions/v1/delete-account') {
      const handler = createDeleteAccountHandler({
        url: 'http://fixture',
        publicKey: 'public',
        secretKey: 'secret',
        createClient: (_url, key) =>
          key === 'public'
            ? {
                auth: {
                  getUser: async () => ({
                    data: { user },
                    error: user ? null : { message: 'invalid' },
                  }),
                  signInWithPassword: async ({ password }) => ({
                    data: { user },
                    error: password === 'test-password' ? null : { message: 'invalid' },
                  }),
                },
              }
            : {
                auth: {
                  admin: {
                    signOut: async () => ({ error: null }),
                    deleteUser: async (id) => {
                      deletedUsers.add(id);
                      profiles.delete(id);
                      addresses.delete(id);
                      addressBook = addressBook.filter((a) => a.user_id !== id);
                      orders = orders.filter((o) => o.user_id !== id);
                      return { error: null };
                    },
                  },
                },
              },
      });
      const response = await handler(
        new Request('http://fixture/delete-account', {
          method: 'POST',
          headers: {
            authorization: req.headers.authorization ?? '',
            'content-type': 'application/json',
          },
          body: JSON.stringify(args),
        }),
      );
      return reply(response.status, await response.json());
    }
    if (path === '/auth/v1/token') {
      if (url.searchParams.get('grant_type') === 'pkce') {
        const challenge = oauthChallenges.get(args.auth_code);
        const supplied = createHash('sha256')
          .update(args.code_verifier ?? '')
          .digest('base64url');
        if (!challenge || challenge !== supplied)
          return reply(400, { error_code: 'bad_code_verifier', message: 'Invalid PKCE verifier' });
        oauthChallenges.delete(args.auth_code);
      }
      const id = args.email === 'owner@example.com' ? OWNER : CUSTOMER;
      return reply(200, {
        access_token: tokenFor(id),
        refresh_token: 'fixture-refresh',
        expires_in: 3600,
        token_type: 'bearer',
        user: userFor(id),
      });
    }
    if (path === '/auth/v1/logout') return reply(200, {});
    if (path.startsWith('/rest/v1/rpc/')) {
      const rpc = path.split('/').at(-1);
      if (rpc === 'storefront_save_address') {
        if (!user) return reply(401, { code: '42501', message: 'AUTH_REQUIRED' });
        if (addressesUnavailable)
          return reply(404, { code: 'PGRST202', message: 'Missing address setup' });
        if (failAddressSave)
          return reply(500, { code: 'TEST_FAILURE', message: 'Simulated failure' });
        const value = args.p_address;
        let record = value.id
          ? addressBook.find((a) => a.id === value.id && a.user_id === user.id)
          : addressBook.find(
              (a) =>
                a.user_id === user.id &&
                ['name', 'phone', 'address', 'city', 'state', 'pincode', 'shipping_area_id'].every(
                  (key) => a[key] === value[key],
                ),
            );
        if (value.id && !record) return reply(400, { code: 'P0001', message: 'NOT_FOUND' });
        if (!record) {
          record = { id: randomUUID(), created_at: timestamp(), user_id: user.id };
          addressBook.push(record);
        }
        Object.assign(record, value, { id: record.id, user_id: user.id });
        addresses.set(user.id, { ...record });
        return reply(200, record.id);
      }
      if (rpc === 'storefront_is_admin') return reply(200, user?.id === OWNER);
      if (rpc === 'storefront_submit_request' || rpc === 'storefront_submit_order') {
        if (!user) return reply(401, { code: '42501', message: 'AUTH_REQUIRED' });
        if (
          rpc === 'storefront_submit_order' &&
          !['cash_on_delivery', 'manual_upi'].includes(args.p_payment_mode)
        )
          return reply(400, { code: 'P0001', message: 'INVALID_PAYMENT_MODE' });
        if (rpc === 'storefront_submit_order' && args.p_terms_accepted !== true)
          return reply(400, { code: 'P0001', message: 'TERMS_REQUIRED' });
        const previous = orders.find(
          (order) => order.user_id === user.id && order.request_key === args.p_request_id,
        );
        const response = (order) => ({
          id: order.id,
          item_total: order.item_total,
          shipping_price: order.shipping_price,
          shipping_area_name: order.shipping_area_name,
          order_total: order.order_total,
          payment_mode: order.shipping.payment_mode,
        });
        if (previous) return reply(200, response(previous));
        const area = areas.find((area) => area.id === args.p_shipping.area_id && area.is_active);
        if (!area) return reply(400, { code: 'P0001', message: 'AREA_UNAVAILABLE' });
        if (area.price !== args.p_shipping.expected_price)
          return reply(400, { code: 'P0001', message: 'SHIPPING_PRICE_CHANGED' });
        const items = [];
        for (const item of args.p_items) {
          const product = products.find((p) => p.id === item.product_id);
          const variant = product?.product_variants.find((v) => v.id === item.variant_id);
          if (!product || !variant || item.quantity > variant.stock)
            return reply(400, { code: 'P0001', message: 'UNAVAILABLE' });
          items.push({
            name: product.name,
            option: variant.title,
            quantity: item.quantity,
            unit_price: variantPrice(product, variant),
          });
        }
        const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
        const total = Math.round((subtotal + area.price) * 100) / 100;
        if (total !== args.p_expected_total)
          return reply(400, { code: 'P0001', message: 'PRICE_CHANGED' });
        const order = {
          id: randomUUID(),
          user_id: user.id,
          request_key: args.p_request_id,
          created_at: timestamp(),
          status: 'awaiting_confirmation',
          item_total: subtotal,
          shipping_area_id: area.id,
          shipping_area_name: area.name,
          shipping_price: area.price,
          order_total: total,
          items,
          shipping: {
            ...args.p_shipping,
            ...(rpc === 'storefront_submit_order'
              ? {
                  payment_mode: args.p_payment_mode,
                  terms_version: '2026-11-payment-v2',
                  terms_accepted_at: timestamp(),
                }
              : {}),
          },
        };
        orders.unshift(order);
        if (!addressesUnavailable) {
          const { name, phone, address, city, state, pincode } = args.p_shipping;
          const old = addressBook.find(
            (a) =>
              a.user_id === user.id &&
              a.name === name &&
              a.address === address &&
              a.phone === phone &&
              a.shipping_area_id === area.id,
          );
          const addressId = old?.id ?? randomUUID();
          if (!old)
            addressBook.push({
              id: addressId,
              user_id: user.id,
              name,
              phone,
              address,
              city,
              state,
              pincode,
              shipping_area_id: area.id,
              created_at: timestamp(),
            });
          addresses.set(user.id, {
            id: addressId,
            user_id: user.id,
            name,
            phone,
            address,
            city,
            state,
            pincode,
            shipping_area_id: area.id,
          });
        }
        return reply(200, response(order));
      }
      if (user?.id !== OWNER) return reply(403, { code: '42501', message: 'ADMIN_REQUIRED' });
      const record = (action, target_id, label) =>
        activity.unshift({ id: randomUUID(), action, target_id, label, created_at: timestamp() });
      if (rpc === 'storefront_admin_save_shipping_area') {
        const p = args.p_area;
        const id = p.id ?? randomUUID();
        const previous = areas.find((area) => area.id === id);
        if (previous && previous.updated_at !== p.expected_updated_at)
          return reply(400, { code: 'P0001', message: 'CONFLICT' });
        areas = areas.filter((area) => area.id !== id);
        areas.push({ ...p, id, updated_at: timestamp() });
        record('shipping_area_saved', id, p.name);
        return reply(200, id);
      }
      if (rpc === 'storefront_admin_overview')
        return reply(200, {
          active_products: products.filter((p) => p.status === 'active').length,
          low_stock: products.flatMap((p) => p.product_variants).filter((v) => v.stock <= 5).length,
          pending_requests: orders.filter((o) => o.status === 'awaiting_confirmation').length,
          requested_value: orders
            .filter((o) => o.status !== 'cancelled')
            .reduce((sum, o) => sum + o.item_total, 0),
        });
      if (rpc === 'storefront_admin_save_product') {
        const p = args.p_product;
        const id = p.id ?? randomUUID();
        const previous = products.find((p) => p.id === id);
        if (previous && previous.updated_at !== p.expected_updated_at)
          return reply(400, { code: 'P0001', message: 'CONFLICT' });
        const saved = {
          ...p,
          id,
          currency: 'INR',
          created_at: previous?.created_at ?? timestamp(),
          updated_at: timestamp(),
          category_id: p.category_ids[0] ?? null,
          product_categories: p.category_ids.map((id) => ({ category_id: id })),
          product_variants: p.variants.map((v) => ({
            ...v,
            id: v.id ?? randomUUID(),
            updated_at: timestamp(),
            currency: 'INR',
          })),
        };
        products = products.filter((p) => p.id !== id);
        products.unshift(saved);
        record(previous ? 'product_updated' : 'product_created', id, p.name);
        return reply(200, id);
      }
      if (rpc === 'storefront_admin_save_category') {
        const p = args.p_category;
        const id = p.id ?? randomUUID();
        categories = categories.filter((c) => c.id !== id);
        categories.push({ ...p, id });
        record('category_saved', id, p.name);
        return reply(200, id);
      }
      if (rpc === 'storefront_admin_delete_product') {
        const product = products.find((item) => item.id === args.p_product_id);
        if (args.p_confirmation !== 'DELETE')
          return reply(400, { code: 'P0001', message: 'INVALID_DELETE_CONFIRMATION' });
        if (!product) return reply(400, { code: 'P0001', message: 'NOT_FOUND' });
        if (product.updated_at !== args.p_expected_updated_at)
          return reply(400, { code: 'P0001', message: 'CONFLICT' });
        products = products.filter((item) => item.id !== product.id);
        record('product_deleted', product.id, product.name);
        return reply(200, product.id);
      }
      if (rpc === 'storefront_admin_set_stock') {
        for (const p of products) {
          const v = p.product_variants.find((v) => v.id === args.p_variant_id);
          if (v) {
            if (v.updated_at !== args.p_expected_updated_at)
              return reply(400, { code: 'P0001', message: 'CONFLICT' });
            v.stock = args.p_stock;
            v.updated_at = timestamp();
            p.updated_at = timestamp();
            record('stock_updated', v.id, v.sku);
            return reply(200, v.id);
          }
        }
      }
      if (rpc === 'storefront_admin_set_product_status') {
        const p = products.find((p) => p.id === args.p_product_id);
        if (p) {
          p.status = args.p_status;
          p.updated_at = timestamp();
          record('product_' + p.status, p.id, p.name);
          return reply(200, p.id);
        }
      }
      if (rpc === 'storefront_admin_set_order_status') {
        const order = orders.find((o) => o.id === args.p_order_id);
        if (order) {
          order.status = args.p_status;
          record('request_' + order.status, order.id, 'Test request');
          return reply(200, order.id);
        }
      }
      return reply(404, { code: 'PGRST202', message: 'Unknown fixture RPC' });
    }
    if (path.startsWith('/rest/v1/')) {
      const table = path.split('/').at(-1);
      if (table === 'site_settings' && req.method === 'POST') {
        if (req.headers.apikey !== 'test-server-secret')
          return reply(403, { code: '42501', message: 'Denied' });
        const records = Array.isArray(args) ? args : [args];
        for (const record of records) {
          const index = siteSettings.findIndex((row) => row.id === record.id);
          if (index >= 0) siteSettings[index] = { ...siteSettings[index], ...record };
          else siteSettings.push(record);
        }
        return reply(201, records);
      }
      if (table === 'storefront_customer_profiles') {
        if (!user) return reply(403, { code: '42501', message: 'Denied' });
        if (req.method === 'POST') {
          if (args.user_id !== user.id) return reply(403, { code: '42501', message: 'Denied' });
          profiles.set(user.id, args);
          return reply(201, args);
        }
      }
      if (table === 'storefront_delivery_addresses' && addressesUnavailable)
        return reply(404, { code: 'PGRST205', message: 'Missing address setup' });
      if (table === 'storefront_saved_addresses') {
        if (addressesUnavailable)
          return reply(404, { code: 'PGRST205', message: 'Table unavailable' });
        if (!user) return reply(403, { code: '42501', message: 'Denied' });
        if (req.method === 'POST') {
          if (failAddressSave)
            return reply(500, { code: 'TEST_FAILURE', message: 'Simulated save failure' });
          if (args.user_id !== user.id) return reply(403, { code: '42501', message: 'Denied' });
          addresses.set(user.id, args);
          return reply(201, args);
        }
      }
      let rows =
        table === 'site_settings'
          ? siteSettings
          : table === 'storefront_customer_profiles'
            ? profiles.has(user?.id)
              ? [profiles.get(user.id)]
              : []
            : table === 'storefront_delivery_addresses'
              ? addressBook.filter((a) => a.user_id === user?.id)
              : table === 'storefront_saved_addresses'
                ? addresses.has(user?.id)
                  ? [addresses.get(user.id)]
                  : []
                : table === 'products'
                  ? products
                  : table === 'categories'
                    ? categories
                    : table === 'storefront_order_requests'
                      ? orders
                      : table === 'storefront_admin_activity'
                        ? activity
                        : table === 'storefront_shipping_areas'
                          ? areas.filter((area) => user?.id === OWNER || area.is_active)
                          : table === 'product_variants'
                            ? products.flatMap((p) =>
                                p.product_variants.map((v) => ({
                                  ...v,
                                  products: { id: p.id, name: p.name, status: p.status },
                                })),
                              )
                            : [];
      if (['storefront_admin_activity'].includes(table) && user?.id !== OWNER)
        return reply(403, { code: '42501', message: 'Denied' });
      if (table === 'storefront_order_requests' && user?.id !== OWNER)
        rows = rows.filter((order) => order.user_id === user?.id);
      for (const [key, filter] of url.searchParams) {
        if (filter.startsWith('eq.'))
          rows = rows.filter(
            (r) =>
              String(key === 'products.status' ? r.products?.status : r[key]) === filter.slice(3),
          );
        if (filter.startsWith('lte.'))
          rows = rows.filter((r) => Number(r[key]) <= Number(filter.slice(4)));
        if (filter.startsWith('ilike.'))
          rows = rows.filter((r) =>
            String(r[key])
              .toLowerCase()
              .includes(filter.slice(6).replaceAll('%', '').toLowerCase()),
          );
      }
      const count = rows.length;
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? 1000);
      rows = rows.slice(offset, offset + limit);
      res.setHeader(
        'Content-Range',
        `${offset}-${Math.max(offset, offset + rows.length - 1)}/${count}`,
      );
      if (req.headers.accept?.includes('application/vnd.pgrst.object+json'))
        return rows.length === 1
          ? reply(200, rows[0])
          : reply(406, { code: 'PGRST116', message: 'Not found' });
      return reply(200, rows);
    }
    reply(404, { message: 'Fixture endpoint not found' });
  });
  server.listen(54329, '127.0.0.1', () => console.log('Admin test API ready on 54329'));
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
}
