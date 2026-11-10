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

New products and options receive a stable UUID-based SKU automatically. The creation form has no SKU input. Saved products retain their existing SKUs; neither creation nor editing exposes SKU inputs. Numeric fields retain their text while being edited; serialization rounds currency amounts to whole rupees while preserving fractional percentage rates.

Browser coverage verifies creating a simple product and two-option product without entering SKUs, preserving generated SKUs after editing, saving the selected default/category, clearing numeric inputs, image uploads and the phone layout. The tests use isolated fixtures.

## Full shadcn admin redesign

The owner requested a complete admin redesign after the initial product-form update. Scope includes the shell, sign-in/access screens, overview, product list and editor, inventory, categories, shipping, orders and review, content editor, notification composer/history and loading states. The storefront keeps its existing design.

The follow-up audit found mixed component systems: most pages still used bespoke panels/tables, mobile navigation occupied the top of every screen, editing exposed SKU inputs, and native browser selects made the product form look similar to the old version. The old admin stylesheet also coupled visual styling to HTML tags, which competed with shadcn's component styles.

The approved Daciana direction remains: a practical store workspace, white and neutral surfaces, readable charcoal text, restrained rose actions, real logo, and emphasis on orders and inventory. This pass uses the official shadcn/ui New York component sources, with project-specific modifications tracked in the repository.

1. **Spacing:** Consistent page gutters and 24px section gaps, compact table rows, desktop controls with larger phone touch targets.
2. **Colour:** Scoped shadcn tokens for cards, popovers, inputs, borders, sidebar and semantic status badges. Portal content carries the same theme; storefront variables remain separate.
3. **Icons:** Lucide navigation and action icons, with the Daciana monogram in the collapsed sidebar.
4. **Copy:** Short product, inventory, order and delivery descriptions. Existing action names remain recognizable.
5. **Type:** A readable 14px interface, clear page titles, restrained section headings and tabular amounts.
6. **Layout:** Actual shadcn Sidebar with collapsed navigation, mobile Sheet, breadcrumbs and account dropdown; responsive Card/Table layouts throughout.
7. **Details:** Actual shadcn Select, Field, Checkbox, Switch, Input, Textarea, Button, Badge, Alert, Dialog and Tabs components. Both product forms hide SKUs while preserving their saved values. Typed confirmation still protects product deletion.
8. **Visuals:** Existing Storage-backed store logo, product and category images; keyboard-accessible upload buttons preserve the current upload checks. No catalog imagery was invented or replaced.
9. **Motion and loading:** Component state changes explain navigation and menus. Page loading shapes use shadcn Skeleton and match the new cards/forms/tables.

Verification uses fixture-backed browser tests for add/edit/save, automatic and existing SKU preservation, whole rupees, uploads, stock, category hierarchy, status changes, private admin access, mobile navigation, deletion confirmation, sidebar collapse, sign-out and history tabs. No production order, notification or catalog record is created during these tests.
