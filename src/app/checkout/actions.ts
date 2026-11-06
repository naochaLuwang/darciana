'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createCustomerActions } from '@/lib/customer-actions';

export async function submitCheckout(input: unknown) {
  return createCustomerActions(createClient, revalidatePath).submitCheckout(input);
}
