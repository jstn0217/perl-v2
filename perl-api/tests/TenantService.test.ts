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
      theme: input.theme,
      addressLine1: null,
      addressLine2: null,
      barangay: null,
      city: null,
      province: null,
      zipCode: null,
      phone: null,
      timezone: 'Asia/Manila',
      academicYearLabel: null,
      depedSchoolId: null
    });
    await expect(service.createSchool(input)).rejects.toThrow('That school slug is already in use.');
  });

  it('carries the seeded production-grade profile fields for each sample school', async () => {
    const service = new TenantService(createRepositories(dataLayer).tenantRepository);

    await expect(service.getCurrentSchool('st-marys')).resolves.toMatchObject({
      city: 'Makati City',
      phone: expect.any(String),
      timezone: 'Asia/Manila',
      academicYearLabel: 'SY 2025-2026',
      depedSchoolId: 'DEPED-NCR-105234'
    });
    await expect(service.getCurrentSchool('riverside-tech')).resolves.toMatchObject({
      depedSchoolId: 'DEPED-CALABARZON-402117',
      timezone: 'Asia/Manila'
    });
    await expect(service.getCurrentSchool('golden-harvest')).resolves.toMatchObject({
      depedSchoolId: 'DEPED-CENTRALVISAYAS-701845',
      timezone: 'Asia/Manila'
    });
  });

  it('gives each seed school a distinct academic year label and DepEd school ID', async () => {
    const service = new TenantService(createRepositories(dataLayer).tenantRepository);

    const [stMarys, riverside, golden] = await Promise.all([
      service.getCurrentSchool('st-marys'),
      service.getCurrentSchool('riverside-tech'),
      service.getCurrentSchool('golden-harvest')
    ]);

    const academicYearLabels = [stMarys.academicYearLabel, riverside.academicYearLabel, golden.academicYearLabel];
    const depedSchoolIds = [stMarys.depedSchoolId, riverside.depedSchoolId, golden.depedSchoolId];

    expect(new Set(academicYearLabels).size).toBe(3);
    expect(new Set(depedSchoolIds).size).toBe(3);
  });
});
