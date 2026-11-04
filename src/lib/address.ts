import type { z } from 'zod';
import type { addressSchema } from './checkout';
export type SavedAddress = z.infer<typeof addressSchema> & { id?: string };

export function addressFromForm(form: FormData, areaId: string) {
  return {
    ...Object.fromEntries(
      ['name', 'phone', 'address', 'city', 'state', 'pincode'].map((key) => [
        key,
        String(form.get(key) ?? ''),
      ]),
    ),
    shipping_area_id: areaId || null,
  };
}
