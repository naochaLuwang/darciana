'use server';
import { revalidatePath } from 'next/cache';
import { adminSession } from '@/lib/admin';
import { announcementSchema } from '@/lib/push';
import { sendAdminPush } from '@/lib/push-server';
import type { PushResult } from '@/lib/push-delivery';

export async function sendAnnouncement(input: unknown): Promise<PushResult> {
  const session = await adminSession();
  if (!session) return { error: 'Admin access is required.' };
  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { requestId, title, body, path } = parsed.data;
  const result = await sendAdminPush({
    eventKey: `announcement:${requestId}`,
    actorId: session.user.id,
    audience: 'announcements',
    title,
    body,
    path,
  });
  revalidatePath('/admin/notifications');
  return result;
}
