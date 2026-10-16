// Structured Philippine address fields shared by users, schools, and submissions.
// Every field is independently optional; an address is "present" when any field
// is non-empty. See utils/address.ts for the shared display formatter.
export interface AddressFields {
  addressLine1: string | null;
  addressLine2: string | null;
  barangay: string | null;
  city: string | null;
  province: string | null;
  zipCode: string | null;
}

export const ADDRESS_FIELD_KEYS: Array<keyof AddressFields> = [
  'addressLine1',
  'addressLine2',
  'barangay',
  'city',
  'province',
  'zipCode'
];
