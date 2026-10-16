import { ADDRESS_FIELD_KEYS, type AddressFields } from '../types/address';

/** Joins the non-empty structured address parts into a single display string. */
export const formatAddress = (parts: Partial<AddressFields>): string =>
  ADDRESS_FIELD_KEYS.map((key) => parts[key]?.trim()).filter((part): part is string => Boolean(part)).join(', ');
