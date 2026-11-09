import type { Product, Variant } from './commerce';

export type GalleryImage = { url: string; alt: string | null };
export type GalleryRow = GalleryImage & { id: string; position: number | null };
export type ProductMedia = { images: GalleryRow[]; variants: Record<string, GalleryRow[]> };
export type ProductMediaResult = { media: ProductMedia | null; error: string | null };

function imageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (
    !url ||
    [...url].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  )
    return null;
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

export function orderedImages(rows: GalleryRow[] = [], primary?: string | null): GalleryImage[] {
  const seen = new Set<string>();
  const result: GalleryImage[] = [];
  const sorted = [...rows].sort((a, b) => {
    const position =
      (Number.isFinite(a.position) ? a.position! : Number.MAX_SAFE_INTEGER) -
      (Number.isFinite(b.position) ? b.position! : Number.MAX_SAFE_INTEGER);
    return position || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  });
  for (const row of [...sorted, { url: primary, alt: null }]) {
    const url = imageUrl(row.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    result.push({ url, alt: typeof row.alt === 'string' ? row.alt.trim() || null : null });
  }
  return result;
}

export function productGallery(
  product: Product,
  variant: Variant | undefined,
  media: ProductMedia | null,
): GalleryImage[] {
  if (product.has_variants) {
    // Product-wide photos must never leak into a selected option's gallery.
    return variant ? orderedImages(media?.variants[variant.id], variant.image_url) : [];
  }
  const images = orderedImages(media?.images, product.thumbnail_url);
  const seen = new Set(images.map((image) => image.url));
  for (const option of product.product_variants) {
    for (const image of orderedImages(media?.variants[option.id], option.image_url)) {
      if (!seen.has(image.url)) {
        images.push(image);
        seen.add(image.url);
      }
    }
  }
  return images;
}
