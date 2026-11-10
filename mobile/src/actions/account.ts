import { createCustomerActions } from '@/lib/customer-actions';
import { supabase } from '../supabase';
import { refreshScreens } from '../query';
import { isDeviceOnline } from '../network';
import { clearLocalSession } from '../auth-flow';

const actions = createCustomerActions(async () => supabase, refreshScreens);
export async function saveAddress(input: unknown) {
  if (!isDeviceOnline()) return { error: 'Reconnect to save this address.' };
  return actions.saveAddress(input);
}
export async function saveProfile(input: unknown) {
  if (!isDeviceOnline()) return { error: 'Reconnect to update your profile.' };
  return actions.saveProfile(input);
}
export async function deleteAccount(input: unknown) {
  if (!isDeviceOnline()) return { error: 'Reconnect to delete your account.' };
  const result = await actions.deleteAccount(input);
  if (result.deleted) await clearLocalSession(true);
  return result;
}
