import { z } from 'zod';

// Notification destinations are app routes, never arbitrary links or admin pages.
export function notificationPath(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 700) return null;
  if (['/', '/shop', '/categories', '/account', '/more'].includes(value)) return value;
  return /^\/(product|more)\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) ? value : null;
}
export const announcementSchema = z.object({
  requestId: z.uuid(),
  title: z.string().trim().min(1, 'Enter a title.').max(80),
  body: z.string().trim().min(1, 'Enter a message.').max(240),
  path: z
    .string()
    .refine((value) => notificationPath(value) !== null, 'Choose a store page or product link.'),
  confirm: z.literal(true, { error: 'Confirm before sending.' }),
});
export const installationSchema = z.object({
  id: z.uuid(),
  secret: z.string().regex(/^[0-9a-f]{64}$/),
});
export const registrationSchema = installationSchema.extend({
  token: z
    .string()
    .min(32)
    .max(4096)
    .regex(/^[A-Za-z0-9_:.-]+$/),
  announcements: z.boolean(),
});
export function orderPush(status: string) {
  const messages: Record<string, string> = {
    confirmed: 'Your order has been confirmed.',
    completed: 'Your order is complete. Thank you for shopping with us.',
    cancelled: 'Your order has been cancelled. Contact the store if you need help.',
  };
  return messages[status]
    ? { title: 'Daciana order update', body: messages[status], path: '/account' }
    : null;
}
export function pushError(error: { code?: string } | null) {
  return ['42P01', 'PGRST205', '42501'].includes(error?.code ?? '')
    ? 'Run supabase/push-setup.sql in the Supabase SQL Editor first.'
    : 'Notifications are unavailable. Please try again.';
}
