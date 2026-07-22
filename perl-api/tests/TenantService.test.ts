import { MockTenantRepository } from '../src/repositories/mock/MockTenantRepository.js';
import { TenantService } from '../src/services/TenantService.js';

describe('TenantService.getCurrentSchool', () => {
  it('returns the requested school when a known slug is provided', async () => {
    const service = new TenantService(new MockTenantRepository());

    await expect(service.getCurrentSchool('riverside-tech')).resolves.toMatchObject({
      slug: 'riverside-tech',
      name: 'Riverside Technical Institute'
    });
  });

  it('falls back to the default school when the slug is missing', async () => {
    const service = new TenantService(new MockTenantRepository());

    await expect(service.getCurrentSchool()).resolves.toMatchObject({
      slug: 'st-marys'
    });
  });

  it('falls back to the default school when the slug is unknown', async () => {
    const service = new TenantService(new MockTenantRepository());

    await expect(service.getCurrentSchool('unknown-campus')).resolves.toMatchObject({
      slug: 'st-marys'
    });
  });
});
