import { supabase } from './supabase';
import { queryClient } from './query';
import { readCatalog, readDeliveryAreas, readStoreContent } from '@/lib/storefront-data';

export { getSavedAddress, getCustomerProfile, type CustomerProfile } from '@/lib/storefront-data';
export function fetchCatalog() {
  return readCatalog(supabase);
}
export function getCatalog() {
  return queryClient.fetchQuery({
    queryKey: ['catalog'],
    queryFn: fetchCatalog,
    staleTime: 60_000,
  });
}
export function getDeliveryAreas() {
  return readDeliveryAreas(supabase);
}
export function getStoreContent() {
  return readStoreContent(supabase);
}
