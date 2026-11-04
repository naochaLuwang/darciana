'use server';
import { revalidatePath } from 'next/cache';
import { adminSession } from '@/lib/admin';
import { persistContent } from '@/lib/store-content';
import { contentWriter } from '@/lib/store-content-server';
export async function saveContent(input: unknown): Promise<{ error?: string; key?: string }> {
  const result = await persistContent(input, {
    getSession: adminSession,
    createWriter: contentWriter,
    now: () => new Date().toISOString(),
  });
  if (result.key) {
    revalidatePath('/more', 'layout');
    revalidatePath('/admin/content');
  }
  return result;
}
