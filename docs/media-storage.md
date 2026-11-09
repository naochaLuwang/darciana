# Supabase image storage

All new store imagery uses the public `storefront-media` bucket in the configured Supabase project. The existing `product-images` bucket is left alone. The storefront and Android app can display the same public image URLs without signed-URL expiry.

## Admin uploads

Product, option and category image fields now use file uploads instead of external URL inputs. Uploads are limited to JPEG, PNG, WebP and AVIF, up to 5 MB each. The server verifies admin access, the file's signature and MIME type before uploading through the admin's Supabase session; Storage RLS remains authoritative.

Files are organized as:

```text
products/<admin-user-id>/<random-id>.<extension>
variants/<admin-user-id>/<random-id>.<extension>
categories/<admin-user-id>/<random-id>.<extension>
storefront/branding/<name>-<content-hash>.png
storefront/collections/<name>-<content-hash>.webp
```

Use **Replace image** to upload a new file or **Remove image** to clear the record's image. New uploads get unique immutable paths, avoiding stale CDN caches. Files are not physically deleted when a reference is cleared because another record may still use them.

Product and category server actions accept changed image URLs only from this project's public `storefront-media` bucket. An unchanged legacy URL may be retained when editing unrelated fields. Existing product/variant gallery URLs continue to render through the shared gallery code.

Category editing normalizes case, surrounding spaces and repeated hyphens in slugs before saving. For example, the legacy `arts--crafts` becomes `arts-crafts`, so it no longer blocks an image update. Invalid characters still produce a readable field error. Storefront category filters also recognize the older repeated-hyphen spelling.

On product detail pages, a selected variant with images shows only its own gallery and primary image. A variant without any valid image references falls back to the ordered product gallery and thumbnail. Images from other variants are excluded. The same helper runs in the website and bundled native app; website deployment and rebuilding an installed native binary are separate steps.

## Branding and homepage artwork

The logo, monogram and three homepage photos are uploaded to Storage. `StoreImage` reads the versioned public paths from `src/lib/store-assets.json`; it uses the bundled original only when Storage fails or the device is offline. Native launcher icons, notification icons and splash resources must remain compiled into the Android app.

When replacing those originals under `public/`, run:

```bash
npm run storage:setup
```

The setup script uses the server-only `SUPABASE_SECRET_KEY`, verifies/configures the bucket's public flag and file restrictions, uploads content-addressed artwork, checks public responses against the source file hashes, and updates the tracked manifest. It never changes category, profile or banner rows. Deploy/rebuild after changing the manifest or UI.

## Access control

The bucket and admin upload policies were installed by `supabase/admin-setup.sql`. Public delivery is enabled for store images. Uploading requires an enrolled admin; restrictive write guards prevent older permissive policies from granting customer write access. App replacements upload new objects with `upsert: false`, so they do not need object overwrite permission. Do not make unrelated private buckets public.

## Existing Cloudinary links

At setup, all products had already been reset. The 16 preserved categories and one legacy banner still referenced the disabled Cloudinary account. Their original files were not available, so those records were preserved. Upload replacement category images in **Admin → Categories**. The legacy banner is not used by the current homepage; homepage artwork is now served from Storage.
