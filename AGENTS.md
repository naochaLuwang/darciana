<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Store images

- Use Supabase Storage bucket `storefront-media` for all new store imagery. Do not add Cloudinary, Unsplash, or other external image URLs to new catalog records.
- Upload product, variant, and category images through the admin upload controls. Reuse `src/lib/media.ts` for bucket, format, size, and URL validation rules. Uploads require verified admin membership.
- Homepage and brand artwork use `StoreImage` and `src/lib/store-assets.json`. Run `npm run storage:setup` after changing their originals in `public/`; it uploads versioned files and verifies public delivery.
- Keep native launcher icons/splash resources and small bundled artwork copies for offline fallback. Server credentials must never be included in client/mobile bundles.
- Existing legacy image URLs may remain unchanged until replacements are available. Do not invent product/category photos or delete shared Storage files when an image reference is removed.

## Currency amounts

- Display every INR amount as whole rupees with `money()`; never show decimal currency digits.
- Use `roundRupees()` from `src/lib/money.ts` for nearest-rupee rounding, with half rupees rounded up. Round each discounted unit price and delivery charge before summing, so visible prices match checkout totals.
- Admin rupee inputs and flat discounts use whole numbers. Fractional percentage rates remain rates, not currency amounts.
- Keep database checkout calculations aligned with the client. The additive hosted upgrade is `supabase/whole-rupee-setup.sql`; preserve historical order snapshots.
