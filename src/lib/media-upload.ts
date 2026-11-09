import type { SupabaseClient } from '@supabase/supabase-js';
import { imageKind } from './admin-validation.ts';
import { MEDIA_BUCKET, MAX_IMAGE_BYTES, MEDIA_FOLDERS } from './media.ts';

type Dependencies = {
  getSession: () => Promise<{ db: SupabaseClient; user: { id: string } } | null>;
};
export async function persistAdminImage(
  form: FormData,
  { getSession }: Dependencies,
): Promise<{ error?: string; url?: string }> {
  const session = await getSession();
  if (!session) return { error: 'Admin access is required.' };
  const file = form.get('file');
  const folder = form.get('folder') ?? 'products';
  if (!(MEDIA_FOLDERS as readonly unknown[]).includes(folder))
    return { error: 'Choose a valid image destination.' };
  if (!(file instanceof File) || file.size < 12 || file.size > MAX_IMAGE_BYTES)
    return { error: 'Choose an image up to 5 MB.' };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = imageKind(bytes);
  if (!kind || kind.mime !== file.type)
    return { error: 'Use a valid JPEG, PNG, WebP, or AVIF image.' };
  const path = `${folder}/${session.user.id}/${crypto.randomUUID()}.${kind.extension}`;
  const { error } = await session.db.storage
    .from(MEDIA_BUCKET)
    .upload(path, bytes, { contentType: kind.mime, cacheControl: '31536000', upsert: false });
  if (error) {
    console.error('Admin image upload failed:', error.name);
    return { error: 'The image could not be uploaded. Please try again.' };
  }
  return { url: session.db.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl };
}
