import type { SavedAddress } from '@/lib/address';

const fields: {
  name: keyof Omit<SavedAddress, 'shipping_area_id'>;
  label: string;
  autoComplete: string;
  placeholder: string;
  maxLength: number;
  type?: string;
  pattern?: string;
  wide?: boolean;
}[] = [
  {
    name: 'name',
    label: 'Full name',
    autoComplete: 'name',
    placeholder: 'Your full name',
    maxLength: 100,
  },
  {
    name: 'phone',
    label: 'Mobile number',
    autoComplete: 'tel',
    placeholder: '9876543210',
    maxLength: 15,
    type: 'tel',
  },
  {
    name: 'address',
    label: 'Street address',
    autoComplete: 'street-address',
    placeholder: 'House, street, area & landmark',
    maxLength: 300,
    wide: true,
  },
  {
    name: 'city',
    label: 'City',
    autoComplete: 'address-level2',
    placeholder: 'Your city',
    maxLength: 100,
  },
  {
    name: 'state',
    label: 'State',
    autoComplete: 'address-level1',
    placeholder: 'Your state',
    maxLength: 100,
  },
  {
    name: 'pincode',
    label: 'PIN code',
    autoComplete: 'postal-code',
    placeholder: '6-digit PIN',
    maxLength: 6,
    pattern: '[1-9][0-9]{5}',
  },
];

export function AddressFields({ address }: { address?: SavedAddress | null }) {
  return fields.map((field) => (
    <label className={field.wide ? 'wide' : ''} key={field.name}>
      {field.label}
      <input
        name={field.name}
        autoComplete={field.autoComplete}
        placeholder={field.placeholder}
        maxLength={field.maxLength}
        type={field.type || 'text'}
        pattern={field.pattern}
        defaultValue={address?.[field.name] ?? ''}
        required
      />
    </label>
  ));
}
