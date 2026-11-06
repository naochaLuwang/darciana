'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createCustomerActions } from '@/lib/customer-actions';

export async function saveAddress(input: unknown) {
  return createCustomerActions(createClient, revalidatePath).saveAddress(input);
}

export async function saveProfile(input: unknown) {
  return createCustomerActions(createClient, revalidatePath).saveProfile(input);
}

export async function deleteAccount(input: unknown) {
  return createCustomerActions(createClient, revalidatePath).deleteAccount(input);
}
