'use server';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { oauthDestinationCookie } from '@/lib/auth-navigation';
export type AuthState = { error?: string; message?: string };
export async function signInWithGoogle(_: AuthState, form: FormData): Promise<AuthState> {
  const supabase = await createClient();
  if (!supabase) return { error: 'Account access is unavailable. Please try again later.' };
  const origin = (await headers()).get('origin');
  if (!origin) return { error: 'Refresh the page and try again.' };
  const callback = new URL('/auth/callback', origin);
  if (!['http:', 'https:'].includes(callback.protocol))
    return { error: 'Refresh the page and try again.' };
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callback.toString(),
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error || !data.url) return { error: 'Google sign-in could not start. Please try again.' };
  const cookieStore = await cookies();
  cookieStore.set(
    oauthDestinationCookie,
    form.get('next') === 'checkout' ? 'checkout' : 'account',
    {
      httpOnly: true,
      secure: callback.protocol === 'https:',
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    },
  );
  redirect(data.url);
}

const credentials = z.object({
  email: z.email().max(254),
  password: z.string().min(1, 'Enter your password.').max(128),
});
export async function authenticate(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({
    email: String(form.get('email') ?? '').trim(),
    password: form.get('password'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (form.get('mode') === 'register' && parsed.data.password.length < 8)
    return { error: 'Use at least 8 characters for your password.' };
  const supabase = await createClient();
  if (!supabase) return { error: 'Account access is being set up. Please try again later.' };
  const mode = form.get('mode');
  if (mode === 'register') {
    const requestHeaders = await headers();
    const origin = requestHeaders.get('origin');
    const { data, error } = await supabase.auth.signUp({
      ...parsed.data,
      options: origin ? { emailRedirectTo: `${origin}/auth/callback` } : undefined,
    });
    if (error)
      return {
        error:
          error.code === 'over_email_send_rate_limit'
            ? 'Too many emails requested. Please wait a few minutes and try again.'
            : 'We couldn’t create your account. Try signing in, or use a different email.',
      };
    if (!data.session)
      return { message: 'Check your email to confirm your account, then come back and sign in.' };
  } else {
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error)
      return {
        error:
          'We couldn’t sign you in. Check your email and password, and confirm your email if you just registered.',
      };
  }
  redirect(form.get('next') === 'checkout' ? '/checkout' : '/account');
}
export async function signOut() {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect('/account');
}
