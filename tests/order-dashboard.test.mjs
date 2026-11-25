import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { initializeStoreDatabase } from './fixtures/database.mjs';
import {
  parseOrderFilters,
  orderFilterHref,
  orderDatePresets,
  orderQueryStatus,
} from '../src/lib/order-filters.ts';

test('order filters validate real calendar dates, include the whole IST end date and preserve filters in links', () => {
  const filters = parseOrderFilters({
    from: '2026-11-02',
    to: '2026-11-02',
    q: " O'Reilly & 50% ",
    payment: 'unpaid',
    mode: 'cash_on_delivery',
    sort: 'oldest',
    status: 'processing',
    page: '2',
  });
  assert.equal(filters.fromInstant, '2026-11-01T18:30:00.000Z');
  assert.equal(filters.toInstant, '2026-11-02T18:30:00.000Z');
  assert.equal(filters.error, undefined);
  const url = new URL(
    orderFilterHref(filters, { tab: 'cancelled', status: '', page: 1 }),
    'https://example.test',
  );
  assert.equal(url.searchParams.get('q'), "O'Reilly & 50%");
  assert.equal(url.searchParams.get('payment'), 'unpaid');
  assert.equal(url.searchParams.get('from'), '2026-11-02');
  assert.equal(url.searchParams.get('tab'), 'cancelled');
  assert.equal(url.searchParams.has('status'), false);
  assert.equal(parseOrderFilters({}).tab, 'pending');
  assert.equal(orderQueryStatus(parseOrderFilters({})), 'awaiting_confirmation');
  assert.equal(orderQueryStatus(parseOrderFilters({ tab: 'active' })), 'active');
  assert.equal(parseOrderFilters({ status: 'delivered' }).tab, 'active');
  assert.equal(parseOrderFilters({ status: 'cancelled' }).tab, 'cancelled');
  assert.equal(parseOrderFilters({ tab: 'pending', status: 'delivered' }).status, '');
  assert.equal(parseOrderFilters({ tab: 'active', status: 'cancelled' }).status, '');
  assert.equal(url.searchParams.has('page'), false);
  for (const from of ['2026-02-30', '2026-13-01', 'junk', '0000-01-01'])
    assert.ok(parseOrderFilters({ from }).error);
  assert.ok(parseOrderFilters({ from: '2026-11-03', to: '2026-11-02' }).error);
  assert.equal(parseOrderFilters({ from: '2024-02-29' }).error, undefined);
  assert.equal(
    parseOrderFilters({
      q: ['first', 'second'],
      status: 'intruder',
      payment: 'bogus',
      sort: 'bogus',
      page: '-1',
    }).q,
    'first',
  );
  assert.equal(parseOrderFilters({ status: 'intruder' }).status, '');
  assert.equal(parseOrderFilters({ page: '999999' }).page, 1);
  assert.deepEqual(orderDatePresets(new Date('2026-11-24T20:00:00Z')), [
    { label: 'Today', from: '2026-11-25', to: '2026-11-25' },
    { label: 'Last 7 days', from: '2026-11-19', to: '2026-11-25' },
    { label: 'Last 30 days', from: '2026-10-27', to: '2026-11-25' },
    { label: 'All time', from: '', to: '' },
  ]);
});

test('order dashboard SQL aggregates every filtered order, enforces access and keeps metrics consistent across pages and tabs', async () => {
  const db = new PGlite();
  const customer = '11111111-1111-4111-8111-111111111111';
  const owner = '22222222-2222-4222-8222-222222222222';
  try {
    await initializeStoreDatabase(db, customer, owner);
    await db.exec(
      await readFile(new URL('../supabase/shipping-setup.sql', import.meta.url), 'utf8'),
    );
    const statuses = [
      'awaiting_confirmation',
      'confirmed',
      'processing',
      'shipped',
      'out_for_delivery',
      'delivered',
      'completed',
      'cancelled',
    ];
    const dates = [
      '2026-11-01T18:30:00Z',
      '2026-11-02T04:00:00Z',
      '2026-11-02T18:29:59.999Z',
      '2026-11-02T18:30:00Z',
      '2026-11-03T12:00:00Z',
      '2026-11-04T12:00:00Z',
      '2026-11-05T12:00:00Z',
      '2026-11-02T10:00:00Z',
    ];
    for (let index = 0; index < 8; index++)
      await db.query(
        `insert into public.storefront_order_requests(id,user_id,request_key,items,item_total,order_total,shipping_price,shipping_area_name,shipping,status,payment_status,created_at)
      values($1,$2,gen_random_uuid(),'[]',$3,$4,50,'Test area',$5::jsonb,$6,$7,$8)`,
        [
          `1111000${index + 1}-5555-4555-8555-555555555555`,
          customer,
          (index + 1) * 100,
          (index + 1) * 100 + 50,
          JSON.stringify({
            name: [0, 1, 7].includes(index)
              ? 'Anita Devi'
              : index === 2
                ? "O'Reilly 50%"
                : `Customer ${index + 1}`,
            phone: index === 2 ? '9876543222' : '9876543210',
            payment_mode:
              index === 6 ? undefined : [2, 5].includes(index) ? 'manual_upi' : 'cash_on_delivery',
          }),
          statuses[index],
          index === 7 ? 'unpaid' : index % 2 === 1 || index === 6 ? 'paid' : 'unpaid',
          dates[index],
        ],
      );
    const login = async (who) => {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [who]);
      await db.exec('set role authenticated');
    };
    const load = async (change = {}) => {
      const p = {
        from: null,
        to: null,
        q: '',
        status: '',
        payment: '',
        mode: '',
        sort: 'newest',
        page: 1,
        ...change,
      };
      return (
        await db.query('select public.storefront_admin_orders($1,$2,$3,$4,$5,$6,$7,$8) as result', [
          p.from,
          p.to,
          p.q,
          p.status,
          p.payment,
          p.mode,
          p.sort,
          p.page,
        ])
      ).rows[0].result;
    };
    await login(customer);
    await assert.rejects(() => load(), /ADMIN_REQUIRED/);
    await login(owner);
    const all = await load();
    assert.deepEqual(all.summary, { total: 8, pending: 1, order_value: 3150, unpaid_value: 1050 });
    assert.equal(all.orders.length, 8);
    assert.equal(all.counts.confirmed, 1);
    const active = await load({ status: 'active' });
    assert.equal(active.count, 6);
    assert.equal(
      active.orders.some((order) => ['awaiting_confirmation', 'cancelled'].includes(order.status)),
      false,
    );
    assert.deepEqual(active.summary, all.summary);
    const range = { from: '2026-11-01T18:30:00Z', to: '2026-11-02T18:30:00Z' };
    const day = await load(range);
    assert.equal(day.count, 4, 'the first and last milliseconds of the IST date are included');
    assert.equal(day.summary.order_value, 750);
    assert.equal(day.summary.unpaid_value, 500);
    assert.equal((await load({ ...range, status: 'active' })).count, 2);
    const tab = await load({ ...range, status: 'cancelled' });
    assert.equal(tab.count, 1);
    assert.deepEqual(tab.summary, day.summary, 'tabs keep the same overview scope');
    assert.deepEqual(tab.counts, day.counts);
    const paid = await load({ ...range, payment: 'paid' });
    assert.equal(paid.count, 1);
    assert.equal(paid.orders[0].status, 'confirmed');
    assert.equal((await load({ mode: 'unrecorded' })).orders[0].status, 'completed');
    assert.equal((await load({ q: 'ANITA' })).count, 3);
    assert.equal((await load({ q: '9876543222' })).count, 1);
    assert.equal((await load({ q: '#11110003' })).orders[0].status, 'processing');
    assert.equal(
      (await load({ q: "O'Reilly 50%" })).count,
      1,
      'search treats punctuation literally',
    );
    assert.equal((await load({ q: '#' })).count, 0);
    assert.equal((await load({ q: 'does not exist' })).summary.total, 0);
    assert.equal((await load({ sort: 'highest_total' })).orders[0].status, 'cancelled');
    assert.equal((await load({ sort: 'lowest_total' })).orders[0].status, 'awaiting_confirmation');
    assert.equal((await load({ sort: 'oldest' })).orders[0].status, 'awaiting_confirmation');
    await assert.rejects(() => load({ status: 'bogus' }), /INVALID_FILTERS/);
    await db.exec('reset role');
    await db.query(
      `insert into public.storefront_order_requests(user_id,request_key,items,item_total,shipping,status,payment_status,created_at)
      select $1,gen_random_uuid(),'[]',100,'{}','processing','unpaid','2026-11-06T12:00:00Z'::timestamptz + n*interval '1 second' from generate_series(1,30) n`,
      [customer],
    );
    await login(owner);
    const first = await load();
    const second = await load({ page: 2 });
    assert.equal(first.orders.length, 25);
    assert.equal(second.orders.length, 13);
    assert.equal(first.count, 38);
    assert.equal(first.summary.order_value, 6150, 'metrics include rows beyond the first page');
    assert.deepEqual(first.summary, second.summary);
    assert.equal(new Set([...first.orders, ...second.orders].map((order) => order.id)).size, 38);
    assert.equal((await load({ page: 999 })).page, 2, 'out-of-range pages clamp to the last page');
    const pending = await load({ status: 'awaiting_confirmation', page: 999 });
    assert.equal(pending.page, 1);
    assert.equal(pending.count, 1);
    assert.equal(
      (
        await db.query(
          "select has_function_privilege('anon','public.storefront_admin_orders(timestamptz,timestamptz,text,text,text,text,text,integer)','execute') as allowed",
        )
      ).rows[0].allowed,
      false,
    );
  } finally {
    await db.close();
  }
});
