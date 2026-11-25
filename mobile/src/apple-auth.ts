import { Capacitor, registerPlugin } from '@capacitor/core';
import { supabase } from './supabase';
import { clearLocalSession } from './auth-flow';
import { navigateApp } from './navigation';
import { refreshScreens } from './query';
import { isDeviceOnline } from './network';

type AppleCredential = {
  identityToken: string;
  authorizationCode: string;
  fullName?: string;
};
const AppleAuth = registerPlugin<{
  authorize(options: { nonce: string; state: string }): Promise<AppleCredential>;
}>('DacianaApple');

export const supportsAppleSignIn = () => Capacitor.getPlatform() === 'ios';
const random = () =>
  [...crypto.getRandomValues(new Uint8Array(32))]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');

async function authorize() {
  if (!supportsAppleSignIn()) throw new Error('Apple sign-in is available in the iPhone app.');
  if (!isDeviceOnline()) throw new Error('Reconnect to continue with Apple.');
  const nonce = random();
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce));
  const hashedNonce = [...new Uint8Array(hash)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
  const credential = await AppleAuth.authorize({ nonce: hashedNonce, state: random() });
  return { ...credential, nonce };
}

export async function beginAppleSignIn(next: string) {
  try {
    const credential = await authorize();
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: credential.nonce,
    });
    if (error || !data.user) throw new Error('Apple sign-in could not finish. Please try again.');
    supabase.auth.startAutoRefresh();
    // Apple supplies the name only on the first authorization. Never replace
    // an existing name with an empty value on subsequent sign-ins.
    if (credential.fullName?.trim() && !data.user.user_metadata?.full_name) {
      await supabase.auth.updateUser({ data: { full_name: credential.fullName.trim() } });
    }
    refreshScreens();
    navigateApp(next === 'checkout' ? '/checkout' : '/account', true);
    return {};
  } catch (error) {
    if ((error as { code?: string })?.code === 'CANCELLED') return {};
    return {
      error: error instanceof Error ? error.message : 'Apple sign-in could not finish. Try again.',
    };
  }
}

export async function deleteWithApple() {
  // Keep the original Supabase session until the server has checked that fresh
  // Apple authorization belongs to its owner. Choosing another Apple account
  // must never switch sessions or delete that other account.
  const credential = await authorize();
  const result = await supabase.functions.invoke('delete-account', {
    body: {
      confirmation: 'DELETE',
      reauthentication: 'apple',
      identityToken: credential.identityToken,
      authorizationCode: credential.authorizationCode,
      nonce: credential.nonce,
    },
  });
  if (result.error || result.data?.deleted !== true)
    throw new Error('Account deletion could not finish. Try again or contact the store.');
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  await clearLocalSession(true);
  localStorage.removeItem('darciana.bag.v1');
  localStorage.removeItem('darciana.saved.v1');
  window.dispatchEvent(new Event('darciana-storage'));
  navigateApp('/account?deleted=1', true);
}
