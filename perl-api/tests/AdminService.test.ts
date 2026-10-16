import { AdminService } from '../src/services/AdminService.js';
import { createRepositories, describeForDataLayers } from './helpers/dataLayer.js';

describeForDataLayers('AdminService.createUser id generation', (dataLayer) => {
  it('assigns unique IDs even when many users are created for the same school in the same millisecond', async () => {
    const repositories = createRepositories(dataLayer);
    const service = new AdminService(repositories.tenantRepository, repositories.userRepository);

    const created = await Promise.all(
      Array.from({ length: 25 }, (_, index) =>
        service.createUser('school-st-marys', {
          email: `id-collision-${index}@stmarys.edu`,
          password: 'Password123!',
          firstName: 'Collision',
          lastName: `Test${index}`,
          role: 'STUDENT'
        })
      )
    );

    const ids = created.map((user) => user.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describeForDataLayers('AdminService structured address fields', (dataLayer) => {
  it('round-trips structured address fields on user create and update', async () => {
    const repositories = createRepositories(dataLayer);
    const service = new AdminService(repositories.tenantRepository, repositories.userRepository);

    const created = await service.createUser('school-st-marys', {
      email: 'address-roundtrip@stmarys.edu',
      password: 'Password123!',
      firstName: 'Addie',
      lastName: 'Ressa',
      role: 'STUDENT',
      addressLine1: '12 Sample Street',
      addressLine2: 'Unit 4B',
      barangay: 'Poblacion',
      city: 'Makati City',
      province: 'Metro Manila',
      zipCode: '1210'
    });

    expect(created).toMatchObject({
      addressLine1: '12 Sample Street',
      addressLine2: 'Unit 4B',
      barangay: 'Poblacion',
      city: 'Makati City',
      province: 'Metro Manila',
      zipCode: '1210'
    });

    const updated = await service.updateUser('school-st-marys', created.id, {
      addressLine1: '34 Updated Avenue',
      city: 'Taguig City'
    });

    expect(updated).toMatchObject({
      addressLine1: '34 Updated Avenue',
      addressLine2: 'Unit 4B',
      barangay: 'Poblacion',
      city: 'Taguig City',
      province: 'Metro Manila',
      zipCode: '1210'
    });
  });

  it('round-trips structured address fields on school profile update', async () => {
    const repositories = createRepositories(dataLayer);
    const service = new AdminService(repositories.tenantRepository, repositories.userRepository);

    const updated = await service.updateSchoolProfile('school-riverside', {
      addressLine1: '5 New Road',
      barangay: 'Barangka',
      city: 'Marikina City',
      province: 'Metro Manila',
      zipCode: '1800'
    });

    expect(updated).toMatchObject({
      addressLine1: '5 New Road',
      addressLine2: null,
      barangay: 'Barangka',
      city: 'Marikina City',
      province: 'Metro Manila',
      zipCode: '1800'
    });
  });
});
