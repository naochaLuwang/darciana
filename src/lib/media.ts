export const MEDIA_BUCKET = 'storefront-media';
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
export const MEDIA_FOLDERS = ['products', 'variants', 'categories'] as const;
export type MediaFolder = (typeof MEDIA_FOLDERS)[number];

export function isStoreMediaUrl(value: string, projectUrl: string | undefined): boolean {
  if (!projectUrl || !value) return false;
  if (value !== value.trim() || /[%\\]/.test(value) || /(?:^|\/)\.{1,2}(?:\/|$)/.test(value))
    return false;
  try {
    const project = new URL(projectUrl);
    const url = new URL(value);
    const local =
      project.protocol === 'http:' &&
      ['127.0.0.1', 'localhost', '[::1]'].includes(project.hostname);
    if (
      (!local && url.protocol !== 'https:') ||
      url.origin !== project.origin ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return false;
    const prefix = `/storage/v1/object/public/${MEDIA_BUCKET}/`;
    if (!url.pathname.startsWith(prefix)) return false;
    return url.pathname
      .slice(prefix.length)
      .split('/')
      .every((segment) => /^[a-z0-9][a-z0-9._-]*$/i.test(segment));
  } catch {
    return false;
  }
}

// Existing records may retain their original URL until a replacement is uploaded.
// The previous value must come from the database, never from a form field.
export function validImageChange(
  next: string,
  previous: string | null | undefined,
  projectUrl: string | undefined,
): boolean {
  return next === '' || next === previous || isStoreMediaUrl(next, projectUrl);
}
