import { z } from 'zod';
import { supabase } from '../supabase';
import {
  authRedirectUrl,
  beginGoogleSignIn,
  clearLocalSession,
  rememberAuthFlow,
} from '../auth-flow';
import { navigateApp } from '../navigation';
import { isDeviceOnline } from '../network';
import {
  requestPasswordReset,
  applyNewPassword,
  readRecoveryGrant,
  recoveryStorageKey,
} from '@/lib/password-recovery';
import { authStorage } from '../storage';

export type AuthState = { error?: string; message?: string };
const credentials = z.object({ email: z.email().max(254), password: z.string().min(1).max(128) });

export async function authenticate(_: AuthState, form: FormData): Promise<AuthState> {
  if (!isDeviceOnline()) return { error: 'Reconnect to sign in.' };
  const parsed = credentials.safeParse({
    email: String(form.get('email') ?? '').trim(),
    password: form.get('password'),
  });
  if (!parsed.success) return { error: 'Enter your email address and password.' };
  const next = form.get('next') === 'checkout' ? 'checkout' : 'account';
  try {
    if (form.get('mode') === 'register') {
      if (parsed.data.password.length < 8)
        return { error: 'Use at least 8 characters for your password.' };
      await rememberAuthFlow('signup', next);
      const { data, error } = await supabase.auth.signUp({
        ...parsed.data,
        options: { emailRedirectTo: authRedirectUrl() },
      });
      if (error)
        return { error: 'We couldn’t create your account. Try signing in or try again later.' };
      if (!data.session)
        return { message: 'Check your email to confirm your account, then return to the app.' };
    } else {
      const { error } = await supabase.auth.signInWithPassword(parsed.data);
      if (error)
        return {
          error: 'Check your email and password, and confirm your email if you just registered.',
        };
    }
    navigateApp(next === 'checkout' ? '/checkout' : '/account', true);
    return {};
  } catch {
    return { error: 'Sign-in is unavailable. Reconnect and try again.' };
  }
}

export async function signInWithGoogle(_: AuthState, form: FormData): Promise<AuthState> {
  if (!isDeviceOnline()) return { error: 'Reconnect to sign in.' };
  return beginGoogleSignIn(form.get('next') === 'checkout' ? 'checkout' : 'account');
}

export async function signOut() {
  try {
    if (isDeviceOnline()) await supabase.auth.signOut({ scope: 'local' });
  } finally {
    await clearLocalSession();
    navigateApp('/account', true);
  }
}

export async function forgotPassword(_: AuthState, form: FormData): Promise<AuthState> {
  if (!isDeviceOnline()) return { error: 'Reconnect to request a reset link.' };
  await rememberAuthFlow('recovery', 'account');
  return requestPasswordReset(supabase, form.get('email'), authRedirectUrl());
}

export async function updatePassword(_: AuthState, form: FormData): Promise<AuthState> {
  if (!isDeviceOnline()) return { error: 'Reconnect to update your password.' };
  try {
    const result = await applyNewPassword(
      supabase,
      { password: form.get('password'), confirmation: form.get('confirmation') },
      readRecoveryGrant(await authStorage.getItem(recoveryStorageKey)),
    );
    if (result.error) return result;
    await supabase.auth.signOut({ scope: 'global' });
    await supabase.auth.signOut({ scope: 'local' });
    await clearLocalSession();
    navigateApp('/account?password=updated', true);
    return {};
  } catch {
    return { error: 'Could not update your password. Reconnect and try again.' };
  }
}
