import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

export const recoveryCookie = 'daciana.password-recovery';
export const recoveryStorageKey = 'daciana.password-recovery.v1';
export const resetEmailSchema = z.email().max(254);
export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Use at least 8 characters.').max(128),
    confirmation: z.string(),
  })
  .refine((value) => value.password === value.confirmation, 'Passwords do not match.');
export const recoveryGrant = (userId: string) =>
  JSON.stringify({ userId, expires: Date.now() + 15 * 60 * 1000 });
export function readRecoveryGrant(raw: string | null | undefined): string | null {
  try {
    const parsed = z
      .object({ userId: z.uuid(), expires: z.number() })
      .safeParse(JSON.parse(raw || ''));
    return parsed.success && parsed.data.expires > Date.now() ? parsed.data.userId : null;
  } catch {
    return null;
  }
}
export async function requestPasswordReset(
  db: SupabaseClient | null,
  email: unknown,
  redirectTo: string,
) {
  const parsed = resetEmailSchema.safeParse(typeof email === 'string' ? email.trim() : email);
  if (!parsed.success) return { error: 'Enter a valid email address.' };
  if (!db) return { error: 'Password reset is unavailable. Try again later.' };
  try {
    const { error } = await db.auth.resetPasswordForEmail(parsed.data, { redirectTo });
    if (error)
      return {
        error:
          error.status === 429
            ? 'Please wait a few minutes before trying again.'
            : 'We couldn’t send a reset link. Try again later.',
      };
    return { message: 'If an account exists, we’ll email a reset link. Open it on this device.' };
  } catch {
    return { error: 'We couldn’t send a reset link. Reconnect and try again.' };
  }
}
export async function applyNewPassword(
  db: SupabaseClient | null,
  input: unknown,
  recoveryUserId: string | null,
) {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!db || !recoveryUserId) return { error: 'This reset link has expired. Request a new one.' };
  const { data, error } = await db.auth.getUser();
  if (error || !data.user || data.user.id !== recoveryUserId)
    return { error: 'This reset link has expired. Request a new one.' };
  const result = await db.auth.updateUser({ password: parsed.data.password });
  return result.error
    ? {
        error:
          result.error.code === 'same_password'
            ? 'Choose a different password.'
            : 'Could not update your password. Try again.',
      }
    : { updated: true as const };
}
