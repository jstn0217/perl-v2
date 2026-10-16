import { formatAddress } from '../src/utils/address.js';

describe('formatAddress', () => {
  it('joins non-empty parts with a comma and space', () => {
    expect(
      formatAddress({
        addressLine1: '145 P. Burgos Street',
        addressLine2: null,
        barangay: 'Poblacion',
        city: 'Makati City',
        province: 'Metro Manila',
        zipCode: '1210'
      })
    ).toBe('145 P. Burgos Street, Poblacion, Makati City, Metro Manila, 1210');
  });

  it('skips gaps left by empty or missing fields', () => {
    expect(
      formatAddress({
        addressLine1: '145 P. Burgos Street',
        city: 'Makati City'
      })
    ).toBe('145 P. Burgos Street, Makati City');
  });

  it('returns an empty string when every field is empty', () => {
    expect(
      formatAddress({
        addressLine1: null,
        addressLine2: null,
        barangay: null,
        city: null,
        province: null,
        zipCode: null
      })
    ).toBe('');
  });
});
