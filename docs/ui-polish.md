# Daciana storefront design

This work applies [Unslop](https://github.com/heydamir/unslop), created by Damir Sokolovsky and licensed under CC BY 4.0, to the shared Next.js and Capacitor storefront. The user's request for a more expressive ecommerce app sets the direction: colorful retail presentation with readable controls and familiar shopping behavior.

## Direction and audit

The audit identified an overly uniform neutral palette, indistinguishable collection shortcuts, a small flat campaign illustration, weak promotion labels and product actions hidden on touch screens. The logo, personal greeting, search, bottom navigation and compact checkout supplied the essential app structure.

- **Product:** everyday cosmetics and stationery shopping with local delivery and COD.
- **Character:** playful, colorful, welcoming.
- **World:** beauty packaging, notebooks, pens and a neighborhood shop, with rose, lilac, peach and brown.
- **Moments:** the photographic cosmetics-and-stationery banner and two product-photo collection cards.
- **Signature:** the supplied Daciana wordmark and monogram, paired with berry shopping actions.

The requested greeting and larger mobile tap targets take precedence over the skill's generic no-greeting and compact navigation guidance. The user specifically requested a richer retail appearance, so collection and merchandising colors carry more of the presentation than a neutral dashboard treatment would.

## Nine passes

| Pass    | Result                                                                                                                                                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Spacing | Consistent card padding, product-grid gaps and section spacing. Product actions align within each row. Mobile navigation retains safe-area spacing.                                                                                              |
| Color   | A berry action color (`#8c3456`), rose selections, distinct collection colors, and rose/lilac/peach/sage product surfaces. Text remains dark and the header white.                                                                               |
| Icons   | The existing Lucide family remains consistent. Color differentiates shopping shortcuts without adding decorative badges.                                                                                                                         |
| Copy    | Short shopping labels: “Shop now,” “Choose options,” “Find your favourites,” and “More to explore.” Discounts and stock labels come from actual catalog data.                                                                                    |
| Type    | Readable interface labels, stronger prices and section titles, and a Georgia display face for the campaign and collection headlines. Currency figures retain tabular numerals.                                                                   |
| Layout  | Search and shortcuts lead into the photographic banner, an initial product grid, the cosmetics/stationery collection cards, then more products. Bottom tabs retain Home, Categories, Saved, Profile and More.                                    |
| Details | White bordered product cards, visible sale badges, save controls and permanent 44px shopping links replace hover-only product actions. Links open the existing product/variant flow.                                                             |
| Visuals | A generated campaign photograph complements the supplied brand artwork. The homepage logo appears in every customer-page header and replaces the text branding in More. Actual listings continue to use catalog photos or the monogram fallback. |
| Motion  | Brief press and color feedback only. Product-photo zoom stays removed, and reduced-motion support remains.                                                                                                                                       |

## Campaign asset

The built-in image-generation tool created the banner. The final optimized WebP is saved at `public/collections/everyday-edit.webp` and copied to `mobile/public/collections/everyday-edit.webp` so both builds bundle the same asset. It is representative category artwork, not photography of a specific catalog listing. The supplied logo is unchanged.

Generation prompt:

> Use case: ads-marketing. Create one finished ecommerce campaign photograph for Daciana, a cosmetics and stationery shopping app. Wide landscape 3:2 composition, suitable for a responsive banner. Photorealistic editorial studio still life: a small curated arrangement of a berry lipstick in dark brown and gold packaging, a blush-pink cosmetic compact, a pale lilac notebook, a coral spiral notebook and two fine pens. All items unbranded. Right half holds the arrangement in a carefully styled layered composition with clear tactile materials and soft contact shadows; leave the entire left 48 percent calm and empty for live HTML headline and button. Backdrop is a warm pastel pink studio sweep #f6d8df, with soft directional daylight. Rich rose and lilac accents, a little apricot, dark brown packaging links to existing logo. Bright, inviting contemporary retail photography with crisp realistic object detail, no floating objects. No typography, no letters, no logos, no watermark, no people, no UI. This is representative category campaign imagery, not an image of a specific product for sale.

## Verification and scope

Visual inspection covers Home at 320px, 393px and 1280px, shop and More at 320px and 393px, plus sign-in, profile, product detail, address selection and checkout. Local screenshots and metrics are under `artifacts/unslop/retail/` and remain ignored by Git. Customer mutations and checkout checks use the isolated fixture API; the live catalog is read only.

The app bundles local customer screens and the banner asset. Physical-device testing and website deployment remain separate from local build verification. Catalog image URLs that fail to load retain the monogram fallback rather than invented product photos.

- The final Next.js production build, web and mobile TypeScript checks, formatting and whitespace checks passed. ESLint reported only the existing unused `_key` warning in the admin product editor.
- All five mobile UI tests passed, covering navigation, search, profile, saved addresses, COD checkout, Google callback handling, offline behavior, sign-out and route-specific skeletons.
- Twelve inspected screen sizes/states had no horizontal overflow, no inspected controls below 44px and no browser JavaScript errors. Header-logo home links retain a 44px tap height even when the artwork scales down.
- The production-configured mobile bundle passed the existing server-key and local-asset checks before Android synchronization.
- `artifacts/daciana-debug.apk` rebuilt successfully (8,065,322 bytes). Its signature, application ID, production Supabase configuration, bundled collection assets, skeletons and updated styling were verified. No server keys or fixture credentials are packaged.

See [loading and product deletion](loading-and-product-deletion.md) for the latest skeletons, text-free collection photos, image prompts and admin deletion setup.
