# Daciana

A cosmetics and stationery storefront built with **Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, and Supabase**. Prices are in INR.

## Run locally

Use Node.js 22.18.0 (`.nvmrc`), or a newer compatible runtime meeting `engines.node`.

```bash
nvm install
nvm use
npm install
# .env.local is already configured on the original workstation.
# On another machine, copy .env.example to .env.local and fill in the public values.
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The project URL and publishable key belong in `.env.local`, which is ignored by Git. Content editing also uses `SUPABASE_SECRET_KEY` on the server; it must never have a `NEXT_PUBLIC_` prefix. No database password is used. Commit `package-lock.json` with the app.

Tailwind v4 runs through the standard `@tailwindcss/postcss` configuration in `postcss.config.mjs`. Both `npm run dev` and `npm run build` explicitly use Next.js's supported `--webpack` option, avoiding the reported Turbopack PostCSS helper-process startup panic. The source stylesheet is `src/app/globals.css`, imported by `src/app/layout.tsx`; admin styles are ordinary CSS in `src/app/admin/admin.css`. No custom CSS loader is configured.

## Included

- Mobile app layout with persistent Home, Categories, Saved, Profile, and More tabs. The shopping bag is accessible from the header.
- Compact home feed, collection shortcuts, custom illustrations, and touch-friendly product grids.
- Dedicated category and saved-item screens, collapsible filters, and route-aware app headers.
- Fixed product purchase and bag checkout controls on phones, above the navigation tabs.
- Live catalog from the existing Supabase `products`, `product_variants`, `categories`, and `product_categories` tables.
- Product detail pages with variant selection, stock limits, discounts, and INR prices.
- Search by name or brand, category filters with nested categories, sorting, and in-stock filtering.
- Favourites and shopping bag saved in browser local storage; quantities and totals use the current catalog rather than saved prices.
- Bag cards show sold-out, insufficient-stock, or removed-item status individually. Both checkout controls stay disabled until unavailable items are removed or quantities are corrected.
- Email/password sign-up and sign-in, confirmation callback, cookie session refresh, and sign-out.
- Google sign-in through Supabase PKCE on web and Android; see the [Google setup walkthrough](docs/google-sign-in.md).
- India delivery form, validated order requests, confirmation screen, and account order history.
- Protected `/admin` store console with product/option editing, image uploads, stock updates, categories, order-request review, and an activity history.
- Dedicated **Admin → Prices** for product and variant pricing, amount/percentage discounts, whole-rupee selling-price previews, search and visibility filters.
- Shipping area names and INR delivery prices in admin, with a searchable area dropdown and delivery-inclusive totals at checkout.
- Dynamic Support & info and Legal pages, managed in **Admin → More content**.

## Admin dashboard

Open [http://localhost:3000/admin](http://localhost:3000/admin). The admin console has its own responsive navigation, separate from the customer app tabs.

Use **Admin → Prices** (`/admin/prices`) to update prices and discounts. The page shows a compact product list. Select a product to open its price editor, choose an option if needed, then use **Save changes**. **Add discount** reveals optional discount controls; **Cancel** discards unsaved edits. This section uses the existing authenticated product-save transaction, so an installed admin dashboard needs no new SQL setup. Stale edits are rejected if another change happens before saving.

The UI and database scripts are implemented. Read-only inspection confirmed the live storefront tables and RPCs, including profiles and saved addresses. Owner sign-in, storage policies, and live mutations still need verification. No live catalog records, orders, or auth accounts were changed while building this dashboard.

For a new project, use these setup steps in the [Supabase SQL Editor](https://supabase.com/dashboard/project/bcozsouelwdvlkcfxerx/sql/new). Skip scripts already applied to the existing project:

1. If order-request setup is still pending, run [`supabase/setup.sql`](supabase/setup.sql) once. Skip it if `storefront_order_requests` and its submission function are already installed.
2. Review and run [`supabase/admin-setup.sql`](supabase/admin-setup.sql) once. It adds the private admin registry, validated admin RPCs, activity history, catalog read/write policies, and the public `storefront-media` image bucket. Then run [`supabase/product-delete-setup.sql`](supabase/product-delete-setup.sql) to enable permanent product deletion; this upgrade is safe to rerun and does not delete any products when installed.
3. Ensure `luwangtech0@gmail.com` exists in **Authentication → Users** and has a confirmed email. Use the normal sign-up flow or create/confirm the account in Supabase; use its existing password when signing in.
4. Run [`supabase/grant-owner.sql`](supabase/grant-owner.sql) to enroll that specific confirmed account. It sets no password and grants no access to other users.
5. Run [`supabase/shipping-setup.sql`](supabase/shipping-setup.sql) once to install delivery areas, order price snapshots, and the updated checkout validation. Add at least one active area at `/admin/shipping` before opening checkout.
6. Run [`supabase/address-setup.sql`](supabase/address-setup.sql) once to enable private saved addresses in customer profiles and automatic address saving at checkout.
7. Run [`supabase/checkout-setup.sql`](supabase/checkout-setup.sql) once to enable cash-on-delivery checkout and recorded terms acceptance.
8. Run [`supabase/profile-setup.sql`](supabase/profile-setup.sql) once for customer profiles and multiple saved addresses. Deploy the account deletion function as described below.
9. Sign in at `/admin`, run Supabase's database security advisors, and verify a test product/stock/category/shipping change and a test request status update.

These are one-time setup scripts, not idempotent migrations. Keep `private` out of the exposed Data API schemas. The catalog's new restrictive write policies require admin membership even when older permissive policies exist; enroll any other legitimate store administrators through the SQL Editor before relying on their existing direct catalog access. Existing public catalog reads are preserved.

Admin permissions come from `private.storefront_admins`, never from user-editable profile metadata or an email comparison in browser code. Pages, reads, server actions, and mutation functions check access. Removing a registry entry revokes admin operations without waiting for a JWT role refresh. Catalog and order operations use the signed-in user's cookie session and the publishable key. The existing `site_settings` content editor separately uses a server-only secret after verifying admin access.

What the console supports:

- Overview with active product counts, low-stock options, requests awaiting confirmation, and requested item value (not collected revenue).
- Paginated product list, name search, visibility filters, new/edit forms, option pricing/discounts/SKUs, category assignments, and reversible activation/inactivation.
- Option-level stock updates with conflict detection. Product edits are transactional and also detect stale edits after a stock change.
- Category creation/editing, parent selection, and database protection against category loops.
- Shipping area creation/editing with a delivery price, active/inactive status, duplicate-name protection, and stale-edit detection.
- JPEG/PNG/WebP/AVIF image uploads up to 5 MB, with byte-signature validation and admin-only storage writes. Uploaded images are public storefront assets; replacing a link does not delete an older image. Files uploaded before cancelling a draft remain in Storage for later cleanup.
- Request delivery details and status transitions: awaiting confirmation → confirmed/cancelled; confirmed → completed/cancelled. Changes require a review checkbox and are recorded in the activity history. Status changes do not collect payment, notify a customer, or reserve/deduct stock.

Existing options are retained while editing a product; set an unwanted option to zero stock. On `/admin/products`, Delete opens a confirmation dialog requiring `DELETE` before permanently removing the product, all its options, and its category links in one transaction. Saved storefront order snapshots and shared image files remain intact. The database blocks deletion when another integration still references the product or its options, including cascading foreign keys; remove those links or make the product inactive instead. Deletions check for concurrent changes and are recorded in admin activity. Category deletion and admin-user management are not available in the browser.

## Shipping areas and checkout

After applying the order-request and admin scripts, run [`supabase/shipping-setup.sql`](supabase/shipping-setup.sql) once. It adds a separate shipping-area table, admin save permissions, and nullable delivery snapshot fields on existing requests. It replaces the existing checkout function with the same signature, so an older client cannot bypass area validation by calling the previous endpoint. No areas or prices are invented or seeded for your live store.

In **Admin → Shipping**, enter an area name and its delivery price in INR. A price of 0 means free delivery. Disable an area to hide it from checkout while retaining its history. Area names are unique without regard to letter case, with surrounding/repeated whitespace normalized.

Customers search the **Shipping area** dropdown at checkout and select one of the active results. They see the area's price, the item subtotal, and the full order total before submitting. The dropdown supports arrow keys, Enter, Escape, and touch selection. A typed name alone is not a selection. Checkout stays disabled if no valid area is selected or no areas are available.

The database validates the selected active area and recalculates the item and delivery total; client-provided delivery prices are only used to detect a price change. Requests save the area name, delivery charge, and total as an immutable snapshot. Updating/renaming/disabling an area leaves earlier requests and idempotent retries unchanged. Requests created before this feature retain a null delivery charge and show **Not yet priced**, rather than being treated as free delivery. The area dropdown does not infer or validate geographical boundaries from the typed street address/PIN code.

## Customer profile and saved addresses

For a new project, run [`supabase/profile-setup.sql`](supabase/profile-setup.sql) once after the existing order/admin/shipping/address scripts. It adds a separate name/phone profile and an address book, migrates existing single saved addresses, and archives additional delivery addresses without rewriting order snapshots. These tables and RPCs were found in the current live project. RLS limits profiles and addresses to their owner; store admin membership does not reveal other customers’ saved profiles.

**Profile** shows **Complete your profile** until the customer saves their name and phone, then **Update profile**. **Saved addresses** opens `/account/addresses`, where customers add and edit multiple addresses. Profile contact details prefill new address forms. Checkout lists the saved addresses and reuses the selected recipient/address. Saving or submitting a different address retains the previous ones. Repeated identical saves do not add duplicates, and editing a saved address retains its ID. Delivery notes remain order-specific. The older single-address table remains compatible with existing checkout clients and is still used for the most recent delivery address.

**Delete account** asks for the current password and the word `DELETE`. The private data and order-history consequences are shown before the destructive button. To enable live deletion, deploy the complete [`supabase/functions/delete-account`](supabase/functions/delete-account) directory as the `delete-account` Supabase Edge Function. Include `index.ts`, `handler.mjs`, and `deno.json`, and leave **Verify JWT** enabled. The function verifies the user with Supabase Auth, rechecks that account’s password, revokes all sessions, and calls the server-only Auth deletion API for the authenticated ID. Supabase injects its API keys into the Edge runtime; no admin key belongs in Next.js public environment variables. See [Edge Function auth](https://supabase.com/docs/guides/functions/auth), [environment variables](https://supabase.com/docs/guides/functions/secrets), and [Auth user deletion](https://supabase.com/docs/guides/auth/managing-user-data#deleting-users).

Account deletion cascades to the profile, legacy address, saved-address book, and order requests. Existing issued access tokens can remain valid until expiry, but the deleted user’s refresh tokens and sessions are removed, owned private rows are gone, and foreign keys prevent creating new customer rows for that deleted ID. If an account owns Supabase Storage objects, deletion can fail until ownership is transferred; the app does not delete shared store uploads automatically. A failed or undeployed endpoint never displays a successful deletion. Successful deletion signs out the browser and clears its Darciana bag/saved-item storage.

The Edge entry point targets Deno; this machine does not have the Deno CLI, so its deployed runtime has not been checked. Its shared handler is tested locally with injected Auth clients, including wrong passwords, missing sessions, forged target IDs, and service failures. PostgreSQL tests cover row ownership, migration of existing addresses, multiple addresses, editing, and deletion cascades. Isolated browser tests cover profile saving, multiple-address selection at checkout, and the account deletion confirmation. No live account was deleted.

## Customer UI

Customer screens use short headings and direct actions. Repeated promotional slogans, duplicate bag totals, and redundant explanatory paragraphs were removed. Product descriptions expand under **Product details**; empty saved lists hide unused search/filter controls. Prices, stock, shipping fees, pending confirmation, and checkout terms remain visible where needed.

The account screen uses a branded sign-in panel with Google/email access, a password visibility control, and a simple sign-in/create-account switch. Signed-in customers see their profile identity, contact form, saved-address link, order cards, and a separate sign-out row with pending feedback. Name and phone fields stack on phones; account deletion keeps its existing explicit confirmation.

## More and content management

**More** sits at the far right after **Profile**, with links grouped under **Support & info** and **Legal**. It reads the existing public `site_settings` table. The live `privacy_policy`, `return_policy`, and `terms_and_conditions` rows are reused without changing their text. Support pages appear once an administrator adds their content; no contact details or policies are invented. A compact brand card, **Share app** action, and footer complete the screen. Sharing opens the device share sheet where available, otherwise copies the store link or displays it for manual copying. The footer reads the current version from `package.json` and credits **Luwang Tech**.

Open **Admin → More content** (`/admin/content`) to edit a page or add one. Set its title, section, numeric position, plain-text content, and **Show in More** setting. Lower positions appear first. Saving updates the storefront; hiding removes its link and app page. Hidden content remains in the publicly readable table, so this is not private draft storage. Page text is escaped rather than rendered as HTML.

No SQL setup is needed for this feature on the current project. The ignored local environment already has the server-only `SUPABASE_SECRET_KEY`; set the same variable in your hosting provider's server environment when deploying. The save action verifies the user's admin membership before creating the privileged client. Public reads continue using the publishable key. Never include the secret in browser or Capacitor configuration.

Page text stays under its existing setting key. Display settings are stored in separate `storefront_more_meta_<page_key>` rows. Each save upserts the body and metadata together by primary key, preserving existing row IDs and unrelated settings. Timestamp checks reject already-stale editor snapshots; simultaneous saves to the same page can still race. Only publishable information belongs here.

## Compact checkout and cash on delivery

For a new project, run [`supabase/checkout-setup.sql`](supabase/checkout-setup.sql) once after the existing order/admin/shipping/address scripts. Checkout offers **Cash on Delivery (COD)** only, with a cash icon and **Pay in Cash upon delivery** beneath the label. The app also rejects Manual UPI for new submissions. No database update is needed just to remove the option. If the optional Manual UPI SQL upgrade was previously installed, it remains compatible; earlier order payment snapshots and labels are preserved.

Checkout is a compact column: **Shipping info**, tappable **Delivery location**, searchable **Shipping area**, **Price details**, **Select payment mode**, terms checkbox, and **Confirm and order**. The address form and terms open in modal sheets. COD is selected by default. Confirmation requires an address, an active area, an available bag, and accepted terms. Orders remain requests awaiting store confirmation without collecting money or reserving inventory. Idempotent retries return the original saved mode and totals.

The Android app keeps the bag on the device when offline and blocks order submission. Previously loaded screens may remain available during the session; catalog data and remote images are not persisted for full offline browsing. Screens without cached data show an offline message and retry action instead of a loading skeleton. Reconnection refreshes the catalog and customer screens.

## Android app with Capacitor

The Android app is **Daciana**, application ID **com.luwangtech.daciana**. Its customer UI is bundled locally with Capacitor 8. The Next.js website and admin remain available separately. Native features include Android Back, safe areas, keyboard handling, encrypted session storage, Google OAuth return links, connectivity feedback and the share sheet.

Run `npm run android:debug` to build `artifacts/daciana-debug.apk`, or `npm run android:bundle` for a release App Bundle. See the [Android setup and release guide](docs/android-app.md) for SDK requirements, the Supabase redirect URL, account-deletion deployment, signing and installation. Mobile integration tests use `npm run test:mobile-ui`.

## Live checkout verification

The live catalog is connected, and read-only inspection confirmed the storefront order, shipping, address, and profile tables and RPCs. No real order submission was performed. Checkout also needs at least one active delivery area and correctly configured Auth callbacks. Existing live catalog tables and data have not been modified by this build.

1. Open your project's [Supabase SQL Editor](https://supabase.com/dashboard/project/bcozsouelwdvlkcfxerx/sql/new).
2. For a new project only, review and run [`supabase/setup.sql`](supabase/setup.sql) once. It creates `storefront_order_requests` and its validated submission functions in a transaction. Its final queries verify access grants and row-level security. Skip it on the already-configured current project.
3. In **Authentication → URL Configuration**, set the Site URL to your app's URL. Allow `http://localhost:3000/auth/callback` (and `http://127.0.0.1:3000/auth/callback` if you use that host). Add the production callback URL when deploying. Keep the default sign-up confirmation template using `{{ .ConfirmationURL }}` for the PKCE callback flow.
4. Verify admin access and an active shipping area, create a test customer through the app, confirm their email, select an area at checkout, then submit a test order request and check its item/delivery breakdown in account history. This live write check has not been run.

The setup script expects the existing catalog schema inspected in this project. Treat it as a one-time bootstrap script, not an idempotent migration. Do not expose the `private` schema through the Data API. Run Supabase's database advisors after applying it.

An order request is **not a paid or reserved order**. Delivery is priced from the customer's selected area. New checkout requests use the selected payment mode and await store confirmation. The app does not charge a card, decrement inventory, or send order emails. Those integrations can be added once the payment and fulfilment flow is chosen.

## Order request implementation

The public RPC uses `SECURITY INVOKER` and delegates to a narrowly scoped private implementation with an empty search path. That implementation authenticates the caller, derives prices from the catalog and active delivery area, checks stock and product/variant relationships, rejects duplicate variants, validates the delivery address, rate-limits submissions, and saves immutable item/delivery price snapshots. A per-customer request key makes retries idempotent.

Customers receive SELECT access only to their own requests through RLS; they cannot insert or edit requests directly. Enrolled administrators can review requests and update permitted statuses in the `/admin` console after the admin setup is applied.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

Unit and local PostgreSQL tests cover discount rules, variant price sources, cart corruption, category descendants, checkout validation, database authentication, customer isolation, server pricing, stock limits, saved-address ownership, automatic address saving, immutable order addresses, and idempotency. SQL tests use PGlite with a minimal catalog/auth fixture and never write to the live Supabase project.

Browser tests read your catalog and test local interactions; they do not register accounts or submit real orders. They cover bottom-tab navigation, saved and category screens, fixed purchase controls, simulated safe areas, 320px screens, and keyboard viewport changes, as well as the shopping flows:

```bash
npx playwright install chromium
# Keep npm run dev running in a separate terminal.
npm run test:e2e
```

You can use an existing Chromium with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` and override the test server with `PLAYWRIGHT_BASE_URL`. Screenshots and traces are written to the ignored `test-results/` directory.

The admin UI has a separate isolated browser suite:

```bash
npm run test:admin-ui
```

It starts a local fixture API on port 54329 and a separate Next.js dev server on port 3002, using `.next-admin-tests` build output. It tests signed-out/customer denial, owner product/category/stock/request/shipping management, phone layouts, delivery search/keyboard selection, free delivery, invalid/unavailable areas, and a delivery-priced checkout through to order history. Content tests cover authorized editing, adding/hiding links, preserved legal text, and escaped page text. The fixture uses a fake server key and fictional data; it never points to the live Supabase project. PostgreSQL tests run the actual setup scripts in PGlite and cover role enforcement, transaction rollback, conflicts, category loops, media policies, shipping price tampering, historical snapshots, and revocation. Full live writes remain untested.

```bash
npm run format
npm run format:check
npm run lint
npm audit --omit=dev
```

The scaffold's development-only ESLint dependency tree currently reports moderate `minimatch` advisories. Avoid `npm audit fix --force`, which proposes incompatible downgrades. Production dependency audit is a separate check.

## Structure

```text
src/app/                 Routes, server actions, and global design tokens
src/components/          Storefront, bag, account, and checkout components
src/lib/commerce.ts      Shared pricing, category, and cart rules
src/lib/catalog.ts       Server-side public catalog queries
src/lib/supabase/        Cookie-based auth and environment configuration
src/proxy.ts             Auth session refresh for account/checkout routes
supabase/setup.sql       Additive order-request bootstrap and RLS
supabase/admin-setup.sql  Admin registry, RPCs, RLS, storage, and activity history
supabase/grant-owner.sql  Owner enrollment for the confirmed Auth account
supabase/shipping-setup.sql Area prices, shipping RLS, and checkout snapshots
tests/                   Commerce, PostgreSQL, and browser verification
```

The catalog loads up to 1,000 active INR products per request; add server pagination when the catalog grows beyond that. Favourites and bags belong to the browser, not an account. Product imagery comes from the URLs already stored in Supabase.

## Deployment

Amounts use whole rupees throughout the app. Apply [the whole-rupee database upgrade](supabase/whole-rupee-setup.sql) before deploying; see [rounding rules](docs/whole-rupee-pricing.md).

Store images use Supabase Storage. See [image storage and uploads](docs/media-storage.md) for admin uploads, artwork updates, and existing legacy image links.

Android push setup and testing: [FCM notifications](docs/push-notifications.md). Deployments using push also require the server-only `FIREBASE_SERVICE_ACCOUNT_BASE64` variable.

Deploy as a Node-compatible Next.js app, configure the two public Supabase environment variables and server-only `SUPABASE_SECRET_KEY`, verify the database setup, and configure the production auth callback URL. Build with `npm run build` and start with `npm start`. This task creates a local app and does not publish a hosted site.

Configure the host's Node version to 22.18.0 or a newer compatible release. Hosts that offer only major versions should use a current Node 22.x release satisfying `>=22.18.0`. The `.nvmrc` file sets the local nvm version; hosts may require their own dashboard setting. Install from the committed lockfile with `npm ci`, and use **`npm run build`** as the deployment build command so the Webpack flag is applied. Clear the host's build cache for the first redeploy after this toolchain change. `.next` and `node_modules` are ignored generated directories; do not include them in source uploads.

Implementation references: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Next.js App Router](https://nextjs.org/docs/app), and [Tailwind CSS](https://tailwindcss.com/docs).
