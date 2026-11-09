import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { z } from 'zod';
import { NATIVE_AUTH_REDIRECT } from '@/lib/brand';
import { authStorage } from './storage';
import { supabase, authStorageKey } from './supabase';
import { clearPrivateScreens, refreshScreens } from './query';
import { navigateApp, notify } from './navigation';
import { disablePush } from './push';

const flowKey = 'daciana.oauth-flow.v1';
const flowSchema = z.object({
  kind: z.enum(['login', 'signup', 'delete']),
  destination: z.enum(['account', 'checkout']),
  expires: z.number(),
  userId: z.string().optional(),
});
const completed = new Set<string>();
let completing: Promise<void> | null = null;

export function authRedirectUrl() {
  return Capacitor.isNativePlatform()
    ? NATIVE_AUTH_REDIRECT
    : new URL('/auth/callback', window.location.origin).href;
}

export async function rememberAuthFlow(
  kind: 'login' | 'signup' | 'delete',
  next: string,
  userId?: string,
) {
  await authStorage.setItem(
    flowKey,
    JSON.stringify({
      kind,
      destination: next === 'checkout' ? 'checkout' : 'account',
      expires: Date.now() + (kind === 'signup' ? 3_600_000 : 600_000),
      userId,
    }),
  );
}

export async function beginGoogleSignIn(next: string, deleteUserId?: string) {
  try {
    await rememberAuthFlow(deleteUserId ? 'delete' : 'login', next, deleteUserId);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: authRedirectUrl(),
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error || !data.url) return { error: 'Google sign-in could not start. Please try again.' };
    if (Capacitor.isNativePlatform()) await Browser.open({ url: data.url });
    else window.location.assign(data.url);
    return {};
  } catch {
    return { error: 'Google sign-in could not start. Please try again.' };
  }
}

export async function clearLocalSession() {
  await disablePush().catch(() => {});
  supabase.auth.stopAutoRefresh();
  await authStorage.removeItem(authStorageKey);
  await authStorage.removeItem(`${authStorageKey}-code-verifier`);
  await authStorage.removeItem(flowKey);
  clearPrivateScreens();
  window.dispatchEvent(new Event('daciana:signed-out'));
}

function acceptedCallback(raw: string) {
  try {
    const url = new URL(raw);
    const native = new URL(NATIVE_AUTH_REDIRECT);
    if (Capacitor.isNativePlatform())
      return url.protocol === native.protocol &&
        url.hostname === native.hostname &&
        url.pathname === native.pathname
        ? url
        : null;
    return url.origin === window.location.origin && url.pathname === '/auth/callback' ? url : null;
  } catch {
    return null;
  }
}

export async function completeAuthCallback(raw: string) {
  const url = acceptedCallback(raw);
  if (!url) return;
  const code = url.searchParams.get('code');
  if (code && completed.has(code)) return;
  if (completing) return completing;
  completing = (async () => {
    try {
      const stored = await authStorage.getItem(flowKey);
      const flow = flowSchema.safeParse(stored ? JSON.parse(stored) : null);
      if (
        !flow.success ||
        flow.data.expires < Date.now() ||
        !code ||
        url.searchParams.has('error')
      ) {
        navigateApp('/account?error=oauth', true);
        return;
      }
      // The SDK validates the code against the verifier in encrypted storage.
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error || !data.user) {
        navigateApp('/account?error=oauth', true);
        return;
      }
      completed.add(code);
      if (completed.size > 20) completed.delete(completed.values().next().value!);
      if (flow.data.kind === 'delete') {
        if (data.user.id !== flow.data.userId) {
          notify('A different Google account was selected. No account was deleted.');
          navigateApp('/account', true);
          return;
        }
        const result = await supabase.functions.invoke('delete-account', {
          body: { confirmation: 'DELETE', reauthentication: 'google' },
        });
        if (result.error || result.data?.deleted !== true) {
          notify('Account deletion could not be completed. Try again or contact the store.');
          navigateApp('/account', true);
          return;
        }
        await clearLocalSession();
        localStorage.removeItem('darciana.bag.v1');
        localStorage.removeItem('darciana.saved.v1');
        window.dispatchEvent(new Event('darciana-storage'));
        navigateApp('/account?deleted=1', true);
        return;
      }
      refreshScreens();
      navigateApp(flow.data.destination === 'checkout' ? '/checkout' : '/account', true);
    } catch {
      navigateApp('/account?error=oauth', true);
    } finally {
      await authStorage.removeItem(flowKey);
      if (!Capacitor.isNativePlatform() && window.location.pathname === '/auth/callback')
        window.history.replaceState(window.history.state, '', `/${window.location.hash}`);
      if (Capacitor.isNativePlatform()) await Browser.close().catch(() => {});
    }
  })().finally(() => {
    completing = null;
  });
  return completing;
}
