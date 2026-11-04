import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const contentMetaPrefix = 'storefront_more_meta_';
const pageKey = z
  .string()
  .regex(/^[a-z][a-z0-9_]{1,79}$/, 'Use letters, numbers and underscores.')
  .refine((key) => !key.startsWith('storefront_'), 'Choose another link name.');
const pageMetaSchema = z.object({
  key: pageKey,
  title: z.string().trim().min(2).max(100),
  section: z.enum(['support', 'legal']),
  position: z.number().int().min(0).max(9999),
  visible: z.boolean(),
});
export const contentSaveSchema = pageMetaSchema
  .extend({
    content: z.string().trim().max(50000),
    expected_updated_at: z.iso.datetime({ offset: true }).nullable(),
    expected_meta_updated_at: z.iso.datetime({ offset: true }).nullable(),
  })
  .refine(
    (page) => !page.visible || page.content.length > 0,
    'Add page content before showing it in More.',
  );
export type ContentInput = z.infer<typeof contentSaveSchema>;
export type ContentMeta = z.infer<typeof pageMetaSchema>;
export type SettingRow = { id: string; key: string; content: string; updated_at: string | null };
export type ContentPage = ContentMeta & {
  id: string | null;
  content: string;
  updated_at: string | null;
  meta_updated_at: string | null;
};
export const defaultContentPages: ContentMeta[] = [
  { key: 'contact_us', title: 'Contact us', section: 'support', position: 10, visible: true },
  { key: 'about_us', title: 'About us', section: 'support', position: 20, visible: true },
  { key: 'faq', title: 'FAQs', section: 'support', position: 30, visible: true },
  {
    key: 'shipping_info',
    title: 'Shipping & delivery',
    section: 'support',
    position: 40,
    visible: true,
  },
  { key: 'privacy_policy', title: 'Privacy policy', section: 'legal', position: 10, visible: true },
  { key: 'return_policy', title: 'Return policy', section: 'legal', position: 20, visible: true },
  {
    key: 'terms_and_conditions',
    title: 'Terms & conditions',
    section: 'legal',
    position: 30,
    visible: true,
  },
];
export function contentSlug(key: string) {
  return key.replaceAll('_', '-');
}
export function buildContentPages(rows: SettingRow[]): ContentPage[] {
  const byKey = new Map<string, SettingRow>();
  for (const row of [...rows].sort((a, b) =>
    (b.updated_at ?? '').localeCompare(a.updated_at ?? ''),
  ))
    if (!byKey.has(row.key)) byKey.set(row.key, row);
  const metadata = new Map(defaultContentPages.map((page) => [page.key, page]));
  for (const row of byKey.values()) {
    if (!row.key.startsWith(contentMetaPrefix)) continue;
    try {
      const result = pageMetaSchema.safeParse(JSON.parse(row.content));
      if (result.success && row.key === contentMetaPrefix + result.data.key)
        metadata.set(result.data.key, result.data);
    } catch {
      /* Invalid metadata cannot introduce a page or raw markup. */
    }
  }
  return [...metadata.values()]
    .map((meta) => ({
      ...meta,
      id: byKey.get(meta.key)?.id ?? null,
      content: byKey.get(meta.key)?.content ?? '',
      updated_at: byKey.get(meta.key)?.updated_at ?? null,
      meta_updated_at: byKey.get(contentMetaPrefix + meta.key)?.updated_at ?? null,
    }))
    .sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
}
async function contentId(key: string) {
  const bytes = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`darciana-more:${key}`)),
  ).slice(0, 16);
  bytes[6] = (bytes[6] & 15) | 128;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export async function planContentSave(
  rows: SettingRow[],
  input: ContentInput,
  userId: string,
  now: string,
) {
  const current = buildContentPages(rows).find((page) => page.key === input.key);
  const body = rows.find((row) => row.key === input.key);
  const meta = rows.find((row) => row.key === contentMetaPrefix + input.key);
  if (body && !current) throw new Error('KEY_IN_USE');
  if (
    (body?.updated_at ?? null) !== input.expected_updated_at ||
    (meta?.updated_at ?? null) !== input.expected_meta_updated_at
  )
    throw new Error('CONFLICT');
  const metadata: ContentMeta = {
    key: input.key,
    title: input.title,
    section: input.section,
    position: input.position,
    visible: input.visible,
  };
  return [
    {
      id: body?.id ?? (await contentId(input.key)),
      key: input.key,
      content: input.content,
      updated_at: now,
      updated_by: userId,
    },
    {
      id: meta?.id ?? (await contentId(contentMetaPrefix + input.key)),
      key: contentMetaPrefix + input.key,
      content: JSON.stringify(metadata),
      updated_at: now,
      updated_by: userId,
    },
  ];
}

export async function persistContent(
  input: unknown,
  dependencies: {
    getSession: () => Promise<{ user: { id: string }; db: SupabaseClient } | null>;
    createWriter: () => SupabaseClient | null;
    now: () => string;
  },
): Promise<{ error?: string; key?: string }> {
  const parsed = contentSaveSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const session = await dependencies.getSession();
  if (!session) return { error: 'Admin access is required.' };
  const writer = dependencies.createWriter();
  if (!writer)
    return { error: 'Set the server-only SUPABASE_SECRET_KEY to enable content editing.' };
  const { data, error } = await session.db
    .from('site_settings')
    .select('id,key,content,updated_at')
    .order('updated_at', { ascending: false })
    .limit(512);
  if (error) return { error: 'Content could not load. Refresh and try again.' };
  try {
    const records = await planContentSave(
      (data ?? []) as SettingRow[],
      parsed.data,
      session.user.id,
      dependencies.now(),
    );
    const result = await writer.from('site_settings').upsert(records, { onConflict: 'id' });
    if (result.error) return { error: 'Content could not be saved. Try again.' };
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message === 'CONFLICT'
          ? 'This page changed. Refresh before saving.'
          : error instanceof Error && error.message === 'KEY_IN_USE'
            ? 'That link name is already used. Choose another.'
            : 'Content could not be saved. Try again.',
    };
  }
  return { key: parsed.data.key };
}
