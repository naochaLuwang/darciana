import test from 'node:test';
import assert from 'node:assert/strict';
import { isStoreMediaUrl, validImageChange, MAX_IMAGE_BYTES } from '../src/lib/media.ts';
import { persistAdminImage } from '../src/lib/media-upload.ts';

const project = 'https://store-project.supabase.co';
const publicUrl = `${project}/storage/v1/object/public/storefront-media/products/owner/photo.png`;
test('new media references stay in the project bucket; unchanged legacy records can still be edited', () => {
  assert.equal(isStoreMediaUrl(publicUrl, project), true);
  for (const value of [
    'https://res.cloudinary.com/old/photo.png',
    publicUrl.replace('store-project.', 'other-project.'),
    publicUrl.replace('storefront-media', 'private-files'),
    publicUrl.replace('/public/', '/sign/'),
    `${publicUrl}?token=expires`,
    `${publicUrl}#fragment`,
    publicUrl.replace('https://', 'https://user:password@'),
    publicUrl.replace('photo.png', '%2e%2e/private.png'),
    publicUrl.replace('photo.png', '%2fprivate.png'),
    `${project}/storage/v1/object/public/storefront-media/`,
  ])
    assert.equal(isStoreMediaUrl(value, project), false, value);
  const legacy = 'https://res.cloudinary.com/old/photo.png';
  assert.equal(validImageChange(legacy, legacy, project), true);
  assert.equal(validImageChange(legacy, null, project), false);
  assert.equal(validImageChange(publicUrl, legacy, project), true);
  assert.equal(validImageChange('', legacy, project), true);
  const local = 'http://127.0.0.1:54329';
  assert.equal(isStoreMediaUrl(publicUrl.replace(project, local), local), true);
  assert.equal(
    isStoreMediaUrl(publicUrl.replace(project, 'http://external.test'), 'http://external.test'),
    false,
  );
});

test('image uploads require admin access, check file content and limits, and use unique immutable paths', async () => {
  const writes = [];
  const owner = '22222222-2222-4222-8222-222222222222';
  const db = {
    storage: {
      from(bucket) {
        assert.equal(bucket, 'storefront-media');
        return {
          upload: async (path, bytes, options) => {
            writes.push({ path, bytes, options });
            return { error: null };
          },
          getPublicUrl: (path) => ({
            data: { publicUrl: `${project}/storage/v1/object/public/${bucket}/${path}` },
          }),
        };
      },
    },
  };
  const dependencies = { getSession: async () => ({ db, user: { id: owner } }) };
  const makeForm = (bytes, type = 'image/png', folder = 'products') => {
    const form = new FormData();
    form.set('file', new File([bytes], '../../unsafe-name.png', { type }));
    form.set('folder', folder);
    return form;
  };
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1sAAAAASUVORK5CYII=',
    'base64',
  );
  assert.ok((await persistAdminImage(makeForm(png), { getSession: async () => null })).error);
  assert.ok((await persistAdminImage(makeForm('<svg>fake image</svg>'), dependencies)).error);
  assert.ok((await persistAdminImage(makeForm(png, 'image/jpeg'), dependencies)).error);
  assert.ok(
    (await persistAdminImage(makeForm(new Uint8Array(MAX_IMAGE_BYTES + 1)), dependencies)).error,
  );
  assert.ok(
    (await persistAdminImage(makeForm(png, 'image/png', '../../private'), dependencies)).error,
  );
  assert.equal(writes.length, 0);
  const first = await persistAdminImage(makeForm(png), dependencies);
  const second = await persistAdminImage(makeForm(png, 'image/png', 'categories'), dependencies);
  assert.equal(writes.length, 2);
  assert.ok(isStoreMediaUrl(first.url, project));
  assert.ok(isStoreMediaUrl(second.url, project));
  assert.match(writes[0].path, new RegExp(`^products/${owner}/[a-f0-9-]+\\.png$`));
  assert.match(writes[1].path, new RegExp(`^categories/${owner}/[a-f0-9-]+\\.png$`));
  assert.notEqual(writes[0].path, writes[1].path);
  assert.equal(writes[0].options.upsert, false);
  assert.equal(writes[0].options.contentType, 'image/png');
  assert.equal(writes[0].options.cacheControl, '31536000');
});
