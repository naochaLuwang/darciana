# Loading screens, collection photos and product deletion

## Loading behavior

Customer screens use route-specific skeletons for Home, categories, browsing, saved items, product details, the bag, profile, addresses, checkout, sign-in, More and information pages. Android selects the skeleton from the destination screen, including sign-in layouts when the session is known to be signed out. Next.js routes have their own `loading.tsx` boundaries; the root catalog request also streams a matching skeleton instead of blocking the shell.

The header and bottom navigation remain usable. Shapes are non-interactive and hidden from assistive technology. A screen-reader-only status identifies the destination. Animation stops with reduced motion. The old generic loading text and grid are removed. Admin pages also have skeletons for the overview, products/editor, orders/details, inventory, categories, shipping and content.

## Collection artwork

The “Two worlds. One shop.” cards use text-free photographs instead of CSS illustrations. Images contain no logos, words or invented packaging labels. Headings and Explore links are ordinary accessible page text. This category artwork stays separate from catalog product photography.

The built-in image-generation tool produced `public/collections/beauty-edit.webp` and `public/collections/stationery-edit.webp`. Matching copies in `mobile/public/collections/` are bundled into Android. The original homepage campaign and supplied header logo are preserved.

Beauty prompt:

> Photorealistic editorial ecommerce category photograph, landscape 3:2. One unbranded berry lipstick in a dark brown and gold tube, an open blush compact in muted rose packaging, and a soft makeup brush, carefully arranged as a grounded studio still life. Seamless pale pink backdrop exactly #f5dce4, matching tabletop. Soft bright studio light, tactile real materials and subtle contact shadows. Objects centered horizontally, placed mostly in the lower two thirds with clear calm backdrop above. Inviting cosmetics shopping aesthetic. No people, flowers, fabric, floating objects, typography, letters, words, logos, brand names, watermark or UI. Absolutely no text on packaging. This is representative category artwork, not a specific product listing.

Stationery prompt:

> Photorealistic editorial ecommerce category photograph, landscape 3:2. Two unbranded tactile notebooks, one lavender hardcover and one peach spiral notebook, with a lilac pen and a simple gold paperclip, carefully arranged as a grounded studio still life. Seamless pale lilac backdrop exactly #e8e2f4, matching tabletop. Soft bright studio light, real paper and metal materials and subtle contact shadows. Objects centered horizontally, placed mostly in the lower two thirds with clear calm backdrop above. Inviting stationery shopping aesthetic. No people, flowers, fabric, floating objects, typography, letters, words, writing, logos, brand names, watermark or UI. Absolutely no text on notebook covers. This is representative category artwork, not a specific product listing.

## Enable permanent product deletion

Run [`supabase/product-delete-setup.sql`](../supabase/product-delete-setup.sql) in the [SQL Editor](https://supabase.com/dashboard/project/bcozsouelwdvlkcfxerx/sql/new), after the existing admin setup. The script is safe to rerun. Installing it creates the functions and grants; it does not delete products. Application API keys cannot install SQL functions, so this hosted setup remains an owner step.

On `/admin/products`, Delete opens a modal showing the product name. The admin must type `DELETE` before confirming. Cancellation makes no mutation. Pending submissions disable the form, and failures retain the dialog and error.

The server validates input and checks admin access. A public invoker RPC delegates to a guarded private function, following the existing admin pattern. The database checks current registry membership, locks the product and options, checks the displayed product version, and removes the product, variants and category assignments in one transaction. Admin activity records the actor, product ID and name.

Storefront orders retain their saved item, price and address snapshots. Shared image files and categories remain intact. Foreign-key references from another integration block deletion, including cascading references. Remove those links or make the product inactive. Failed deletes roll back every catalog change.

No live products were deleted or changed during implementation or testing.

## Verification

Database tests cover anonymous/customer denial, direct private-function checks, owner revocation, confirmation, stale versions, legacy references, rollback, complete catalog removal, preserved orders and the audit entry. Browser tests cover cancellation, disabled confirmation, conflict errors and removal from the list and storefront. Mobile tests hold API responses for each route to verify matching skeletons, no overflow at 320px, reduced-motion behavior and screen-reader-only loading text.

References: [Next.js loading boundaries](https://nextjs.org/docs/app/api-reference/file-conventions/loading), [Supabase RPC](https://supabase.com/docs/reference/javascript/rpc), [Supabase permissions/RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

Validation completed: Next.js production build; web/mobile type checks; 21 unit/database tests; five mobile browser tests; and all 15 admin/browser scenarios across the full run and targeted reruns after fixes. Formatting passed. ESLint retains only the existing unused `_key` warning in the product editor. The checkout layout check also verified the confirmation button stays above the bottom navigation.

The updated debug APK is `artifacts/daciana-debug.apk` (8,065,322 bytes). Its signature, application ID, production Supabase configuration, bundled skeletons and three collection assets were verified. No server keys, fixture credentials or admin deletion RPC code are bundled into Android. Physical-device installation and hosted SQL installation remain separate owner steps. Local previews are under `artifacts/loading-update/` and `artifacts/unslop/loading-update/`.
