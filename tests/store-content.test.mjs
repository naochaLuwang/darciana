import test from 'node:test';
import assert from 'node:assert/strict';
import {
  contentSaveSchema,
  buildContentPages,
  planContentSave,
  persistContent,
  contentMetaPrefix,
} from '../src/lib/store-content.ts';

const rows = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    key: 'privacy_policy',
    content: 'Original privacy policy.',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    key: 'return_policy',
    content: 'Original return policy.',
    updated_at: '2026-01-01T00:00:00Z',
  },
];
const draft = {
  key: 'contact_us',
  title: 'Contact support',
  section: 'support',
  position: 5,
  visible: true,
  content: 'Email the store for support.',
  expected_updated_at: null,
  expected_meta_updated_at: null,
};
test('More content reuses existing policy text and validates public pages and metadata', () => {
  assert.equal(
    buildContentPages(rows).find((page) => page.key === 'privacy_policy').content,
    rows[0].content,
  );
  for (const invalid of [
    { key: 'storefront_more_meta_privacy_policy' },
    { key: '../settings' },
    { title: '' },
    { content: '' },
    { position: -1 },
    { section: 'secrets' },
  ])
    assert.equal(contentSaveSchema.safeParse({ ...draft, ...invalid }).success, false);
  assert.equal(
    contentSaveSchema.safeParse({ ...draft, visible: false, content: '' }).success,
    true,
  );
});
test('content saves preserve unrelated rows, stable IDs, display settings and conflict checks', async () => {
  const writes = await planContentSave(
    rows,
    contentSaveSchema.parse(draft),
    'owner',
    '2026-11-04T10:00:00Z',
  );
  assert.equal(writes.length, 2);
  assert.equal(writes[0].key, 'contact_us');
  assert.equal(writes[1].key, contentMetaPrefix + 'contact_us');
  assert.equal(
    writes[0].id,
    (
      await planContentSave(rows, contentSaveSchema.parse(draft), 'owner', '2026-11-04T10:00:01Z')
    )[0].id,
  );
  assert.equal(rows[0].content, 'Original privacy policy.');
  const model = buildContentPages([...rows, ...writes]);
  const page = model.find((page) => page.key === 'contact_us');
  assert.equal(page.title, 'Contact support');
  assert.equal(page.section, 'support');
  assert.equal(page.position, 5);
  await assert.rejects(
    () =>
      planContentSave(
        [...rows, ...writes],
        contentSaveSchema.parse(draft),
        'owner',
        '2026-11-04T11:00:00Z',
      ),
    /CONFLICT/,
  );
  const hidden = await planContentSave(
    [...rows, ...writes],
    contentSaveSchema.parse({
      ...draft,
      visible: false,
      expected_updated_at: writes[0].updated_at,
      expected_meta_updated_at: writes[1].updated_at,
    }),
    'owner',
    '2026-11-04T11:00:00Z',
  );
  assert.equal(
    buildContentPages([...rows, ...hidden]).find((page) => page.key === 'contact_us').visible,
    false,
  );
  await assert.rejects(
    () =>
      planContentSave(
        [{ ...rows[0], key: 'payment_config' }],
        { ...draft, key: 'payment_config' },
        'owner',
        '2026-11-04T11:00:00Z',
      ),
    /KEY_IN_USE/,
  );
});
test('only an authorized admin can construct the privileged writer or save content', async () => {
  let writers = 0;
  const saved = [];
  const read = {
    from: (table) => {
      assert.equal(table, 'site_settings');
      return {
        select: () => ({ order: () => ({ limit: async () => ({ data: rows, error: null }) }) }),
      };
    },
  };
  const factory = () => {
    writers++;
    return {
      from: (table) => {
        assert.equal(table, 'site_settings');
        return {
          upsert: async (records, options) => {
            assert.equal(options.onConflict, 'id');
            saved.push(records);
            return { error: null };
          },
        };
      },
    };
  };
  const denied = await persistContent(draft, {
    getSession: async () => null,
    createWriter: factory,
    now: () => '',
  });
  assert.match(denied.error, /Admin access/);
  assert.equal(writers, 0);
  assert.equal(saved.length, 0);
  const success = await persistContent(
    { ...draft, updated_by: 'forged-user' },
    {
      getSession: async () => ({ user: { id: 'verified-owner' }, db: read }),
      createWriter: factory,
      now: () => '2026-11-04T10:00:00Z',
    },
  );
  assert.equal(success.key, 'contact_us');
  assert.equal(saved.length, 1);
  assert.equal(saved[0].length, 2);
  assert.ok(saved[0].every((row) => row.updated_by === 'verified-owner'));
});
