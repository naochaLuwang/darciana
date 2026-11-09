import { supabase } from './supabase';
import { queryClient } from './query';
import {
  readCatalog,
  readDeliveryAreas,
  readStoreContent,
  readProductMedia,
} from '@/lib/storefront-data';

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
export async function getProductMedia(productId: string) {
  const result = await queryClient.fetchQuery({
    queryKey: ['product-media', productId],
    queryFn: () => readProductMedia(supabase, productId),
    staleTime: 60_000,
  });
  if (result.error)
    queryClient.removeQueries({ queryKey: ['product-media', productId], exact: true });
  return result;
}
export function getDeliveryAreas() {
  return readDeliveryAreas(supabase);
}
export function getStoreContent() {
  return readStoreContent(supabase);
}
