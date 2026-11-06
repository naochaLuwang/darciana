import { createCustomerActions } from '@/lib/customer-actions';
import { supabase } from '../supabase';
import { queryClient, refreshScreens } from '../query';
import { isDeviceOnline } from '../network';

const actions = createCustomerActions(async () => supabase, refreshScreens);
export async function submitCheckout(input: unknown) {
  if (!isDeviceOnline())
    return { error: 'Reconnect before placing your order. Your bag is saved.' };
  const result = await actions.submitCheckout(input);
  // Catalog/area changes are authoritative at the database. Refresh the
  // displayed choices after a rejection so customers can correct and retry.
  if ('error' in result) {
    void queryClient.invalidateQueries({ queryKey: ['catalog'] });
    refreshScreens();
  }
  return result;
}
