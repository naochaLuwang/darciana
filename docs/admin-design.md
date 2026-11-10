# Daciana admin design

Direction approved by the owner on 10 November 2026. This pass uses [Unslop by Damir Sokolovsky (@heydamir)](https://heydamir.design/unslop), CC BY 4.0. The store's artwork and brand remain Daciana's.

## Direction

- **Product:** A workspace for Daciana's catalog, stock, delivery and orders.
- **Character:** Practical, calm and warm.
- **World:** Paper receipts and the cosmetics counter.
- **Moments:** Pending orders receive emphasis; metrics and activity remain easy to scan.
- **Signature:** The real Daciana logo, with neatly aligned amounts and order references.

## Audit

- `admin-shell.tsx`: misspelled text wordmark and decorative asterisk replace the actual store logo.
- `admin.css`: lavender backgrounds, borders and text compete with the storefront's brown and rose branding.
- `admin.css`: labels and order details shrink to 6–11px, especially on phones.
- `common.tsx`: every page repeats the tracked, uppercase “Your store, taken care of” slogan.
- `admin.css`: gutters, panel padding and navigation gaps use unrelated values.
- `admin.css`: 45px navigation rows plus wide gaps leave the sidebar unnecessarily sparse.
- `page.tsx`: four repeated icon tiles inflate simple metrics and give every number equal emphasis.
- `page.tsx`: the generic overview introduction occupies space needed by actual store information.
- `page.tsx`: pending orders use a neutral purple badge instead of the existing semantic status styles.
- `admin.css`: date labels and figures do not have consistent readable sizing and alignment.
- `admin-shell.tsx`: the static green owner dot resembles live presence without representing it.
- `admin-login.tsx`: decorative lock tile, old store spelling and promotional headline obscure the sign-in task.
- `admin.css`: uppercase table labels and many near-identical purple tints weaken hierarchy.

## Passes

1. **Spacing:** Use consistent 4px spacing, compact navigation and common panel padding. Form controls retain comfortable touch sizes.
2. **Color:** White and warm grey surfaces, charcoal text, three text roles and Daciana's rose accent. Semantic status colors retain their meaning.
3. **Icons:** Keep Lucide navigation icons at 18px with 1.5 strokes. Remove metric icon tiles and the decorative owner-status dot.
4. **Copy:** Name the context directly: Store overview, Store admin and Admin sign in. Keep the explanation that requested item value is not collected revenue.
5. **Type:** Retain the storefront's interface font, use readable 12–14px labels and metadata, and align amounts with tabular figures.
6. **Layout:** Keep the metrics, orders and activity in their original order. Give orders a wider column; stack the panels on smaller screens.
7. **Details:** Quiet borders, deliberate radii, visible keyboard focus and readable status badges. Highlight orders awaiting confirmation.
8. **Visuals:** Reuse the existing Daciana artwork through `StoreImage` and the Storage manifest. No generated imagery, new photos, charts or invented metrics.
9. **Motion:** Short color and border transitions only, with reduced-motion support.

## Scope

Shared admin navigation, overview, sign-in, access screens and form/table styling. Catalog operations, access checks, order workflows and stored data retain their existing behavior. The base-price clearing fix remains in place.

The existing logo file is reused unchanged. Its Supabase Storage reference and local fallback stay in `src/lib/store-assets.json`; no Storage upload is required for this pass.

Verification evidence and desktop/phone previews are saved under `artifacts/admin-unslop/`.

- All 20 browser checks pass, including authorized editing, customer access restrictions, logo loading, phone navigation, shipping and the base-price clearing fix.
- TypeScript and the production Next.js build pass. Lint has no errors; the pre-existing unused `_key` warning in the product editor remains.
- The eight checked text/status combinations meet 4.5:1 contrast; the lowest checked ratio is 4.79:1.
- Desktop and phone previews were reviewed. Phone checks confirm that navigation and product forms do not cause page overflow.
- Previews use isolated test data. No live catalog, accounts, orders or Storage files were changed.

## Product forms with shadcn/ui

The product editor now uses the official shadcn/ui New York components: Card, Field, Input, Textarea, Native Select, Checkbox, Radio Group and Button. Component sources live in `src/components/ui`; `components.json` records the configuration. Theme tokens are scoped to the admin and use the approved Daciana palette without replacing the storefront's colour variables.

New products and options receive a stable UUID-based SKU automatically. The creation form has no SKU input. Editing a saved product retains its existing SKU and keeps the SKU control available. Numeric fields retain their text while being edited; serialization rounds currency amounts to whole rupees while preserving fractional percentage rates.

Browser coverage verifies creating a simple product and two-option product without entering SKUs, preserving generated SKUs after editing, saving the selected default/category, clearing numeric inputs, image uploads and the phone layout. The tests use isolated fixtures.
