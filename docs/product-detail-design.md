# Product detail design

Approved direction, implemented 9 November 2026.

- Product: make cosmetics and stationery easy to inspect, choose and order.
- Character: warm, tactile, practical.
- World: cream paper, brown ink and restrained rose accents.
- Moments: the actual product photography and variant colour swatches.
- Signature: the selected option has a rose outline and soft rose surface.

## Changes

The previous availability line was easy to miss, and the disabled purchase button still said Add to bag. Sold-out options used an appended label inside the same line. The purchase dock also contained the save action, competing with quantity and ordering controls.

The larger gallery has a smaller thumbnail strip, grouped navigation arrows and a quiet photo counter. The save heart sits in the photo corner and remains usable when the product is unavailable. Variant switches reset the active photo; variants without images still fall back to product photos and the thumbnail.

The name, whole-rupee price, original price when discounted and tax note form one compact summary. A readable availability badge sits beside the price when space allows and wraps on smaller screens. The cream background and brown text stay neutral; rose marks selection and the main action. Available stock uses a toned green status, unavailable stock a muted rose status. Sold-out variant tiles remain selectable with a separate caption and a crossed swatch.

| Stock state                                    | Status and purchase action                                                                                       |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Selected option available                      | In stock, with the actual remaining count below six units; quantity control and Add to bag                       |
| Selected option unavailable, another available | This option is out of stock; Choose another option scrolls to the options and focuses the first available choice |
| No available options                           | Out of stock; disabled Out of stock button; quantity hidden                                                      |

The mobile purchase bar stays above bottom navigation and device safe areas. Desktop uses the two-column gallery and details layout with a gallery that stays visible while scrolling longer details. Product details remain collapsible, delivery information is a compact row and related products remain below. The skeleton follows the new gallery, price/status row and variant sizes. No new image generation or network feature was needed.

## Verification and previews

Two web browser checks cover product galleries, all three stock states, price/quantity behaviour and checkout totals. Three native browser checks cover galleries/stock states, profile/address/COD ordering and route-specific skeletons. Both TypeScript configurations, touched-file lint, formatting and the Next.js production build pass. The mobile production assets are rebuilt and synced to Android after fixture testing.

Previews under `artifacts/product-detail-design/` use isolated test products and image fixtures, not live catalog listings:

- `in-stock.png`
- `variant-sold-out.png`
- `all-sold-out.png`

Deploy the website and rebuild/install Android to distribute these UI changes. Previously delivered APK/AAB files are not updated by editing the shared source or syncing assets.

Design review used [unslop by Damir Sokolovsky](https://github.com/heydamir/unslop), licensed CC BY 4.0.
