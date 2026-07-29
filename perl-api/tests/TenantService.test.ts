import { TenantService } from '../src/services/TenantService.js';
import { createRepositories, describeForDataLayers } from './helpers/dataLayer.js';

describeForDataLayers('TenantService.getCurrentSchool', (dataLayer) => {
  it('returns the requested school when a known slug is provided', async () => {
    const service = new TenantService(createRepositories(dataLayer).tenantRepository);

    await expect(service.getCurrentSchool('riverside-tech')).resolves.toMatchObject({
      slug: 'riverside-tech',
      name: 'Riverside Technical Institute'
    });
  });

  it('falls back to the default school when the slug is missing', async () => {
    const service = new TenantService(createRepositories(dataLayer).tenantRepository);

    await expect(service.getCurrentSchool()).resolves.toMatchObject({
      slug: 'st-marys'
    });
  });

  it('falls back to the default school when the slug is unknown', async () => {
    const service = new TenantService(createRepositories(dataLayer).tenantRepository);

    await expect(service.getCurrentSchool('unknown-campus')).resolves.toMatchObject({
      slug: 'st-marys'
    });
  });

  it('creates a validated school profile and rejects duplicate slugs', async () => {
    const service = new TenantService(createRepositories(dataLayer).tenantRepository);
    const input = {
      name: 'Northview Academy',
      slug: 'northview-academy',
      contactEmail: 'ADMIN@NORTHVIEW.EDU',
      theme: {
        primaryColor: '#123456',
        secondaryColor: '#F2F6FA',
        accentColor: '#FFAA00'
      }
    };

    await expect(service.createSchool(input)).resolves.toMatchObject({
      id: expect.stringMatching(/^school-/),
      name: 'Northview Academy',
      slug: 'northview-academy',
      contactEmail: 'admin@northview.edu',
      logoUrl: null,
      theme: input.theme
    });
    await expect(service.createSchool(input)).rejects.toThrow('That school slug is already in use.');
  });
});
