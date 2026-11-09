import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseEnv } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { MEDIA_BUCKET, MAX_IMAGE_BYTES, IMAGE_MIME_TYPES } from '../src/lib/media.ts';

let local = {};
try {
  local = parseEnv(await readFile('.env.local', 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const env = { ...local, ...process.env };
const base = env.NEXT_PUBLIC_SUPABASE_URL;
if (!base || !env.SUPABASE_SECRET_KEY)
  throw new Error('Configure the Supabase project URL and server-only secret key.');
const db = createClient(base, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: buckets, error: bucketError } = await db.storage.listBuckets();
if (bucketError) throw new Error(`Cannot inspect Storage: ${bucketError.name}`);
const options = {
  public: true,
  fileSizeLimit: MAX_IMAGE_BYTES,
  allowedMimeTypes: [...IMAGE_MIME_TYPES],
};
const existing = buckets.find((bucket) => bucket.id === MEDIA_BUCKET);
if (
  !existing ||
  !existing.public ||
  Number(existing.file_size_limit) !== MAX_IMAGE_BYTES ||
  JSON.stringify([...(existing.allowed_mime_types ?? [])].sort()) !==
    JSON.stringify([...IMAGE_MIME_TYPES].sort())
) {
  const { error } = existing
    ? await db.storage.updateBucket(MEDIA_BUCKET, options)
    : await db.storage.createBucket(MEDIA_BUCKET, options);
  if (error) throw new Error(`Cannot configure Storage: ${error.name}`);
}
const assets = [
  'branding/daciana-logo-transparent.png',
  'branding/daciana-monogram.png',
  'collections/everyday-edit.webp',
  'collections/beauty-edit.webp',
  'collections/stationery-edit.webp',
];
const manifest = {};
for (const asset of assets) {
  const bytes = await readFile(`public/${asset}`);
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error(`Asset exceeds the bucket limit: ${asset}`);
  const hash = createHash('sha256').update(bytes).digest('hex');
  const path = `storefront/${asset.replace(/\.(png|webp)$/, `-${hash.slice(0, 12)}.$1`)}`;
  const contentType = asset.endsWith('.png') ? 'image/png' : 'image/webp';
  const { error } = await db.storage
    .from(MEDIA_BUCKET)
    .upload(path, bytes, { contentType, upsert: false, cacheControl: '31536000' });
  if (error && !['409', 'Duplicate'].includes(String(error.statusCode ?? error.error)))
    throw new Error(`Cannot upload ${asset}: ${error.name}`);
  const {
    data: { publicUrl },
  } = db.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  const response = await fetch(publicUrl, { signal: AbortSignal.timeout(30000) });
  if (
    !response.ok ||
    createHash('sha256')
      .update(Buffer.from(await response.arrayBuffer()))
      .digest('hex') !== hash
  )
    throw new Error(`Public image verification failed: ${asset}`);
  manifest[asset] = path;
  console.log(JSON.stringify({ asset, verified: true, bytes: bytes.length }));
}
await writeFile('src/lib/store-assets.json', `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  'Storage ready. Store artwork uploaded and verified. Existing category and banner records were not changed.',
);
