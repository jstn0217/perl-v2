import { SubmissionService } from '../src/services/SubmissionService.js';
import { createRepositories, describeForDataLayers } from './helpers/dataLayer.js';

describeForDataLayers('SubmissionService.create validation', (dataLayer) => {
  const buildService = (dataLayerName: typeof dataLayer) => {
    const repositories = createRepositories(dataLayerName);
    return new SubmissionService(repositories.submissionRepository, repositories.tenantRepository);
  };

  it('creates an enrollment submission with required fields', async () => {
    const service = buildService(dataLayer);

    const submission = await service.create('school-st-marys', 'ENROLLMENT', 'MANUAL', {
      firstName: 'Ana',
      lastName: 'Reyes',
      email: 'ANA.REYES@example.com',
      gradeLevelApplying: 'Grade 9'
    });

    expect(submission).toMatchObject({
      schoolId: 'school-st-marys',
      type: 'ENROLLMENT',
      status: 'NEW',
      source: 'MANUAL',
      firstName: 'Ana',
      lastName: 'Reyes',
      email: 'ana.reyes@example.com',
      gradeLevelApplying: 'Grade 9',
      message: null,
      notes: null
    });
  });

  it('rejects an enrollment submission missing gradeLevelApplying', async () => {
    const service = buildService(dataLayer);

    await expect(
      service.create('school-st-marys', 'ENROLLMENT', 'MANUAL', {
        firstName: 'Ana',
        lastName: 'Reyes',
        email: 'ana.reyes@example.com'
      })
    ).rejects.toThrow('Grade level applying for is required.');
  });

  it('creates an inquiry submission with required fields', async () => {
    const service = buildService(dataLayer);

    const submission = await service.create('school-st-marys', 'INQUIRY', 'MANUAL', {
      firstName: 'Ben',
      lastName: 'Santos',
      email: 'ben.santos@example.com',
      message: 'Do you have Grade 5 slots open?'
    });

    expect(submission).toMatchObject({
      type: 'INQUIRY',
      message: 'Do you have Grade 5 slots open?',
      gradeLevelApplying: null
    });
  });

  it('rejects an inquiry submission missing message', async () => {
    const service = buildService(dataLayer);

    await expect(
      service.create('school-st-marys', 'INQUIRY', 'MANUAL', {
        firstName: 'Ben',
        lastName: 'Santos',
        email: 'ben.santos@example.com'
      })
    ).rejects.toThrow('Message is required.');
  });

  it('rejects a missing first/last name or malformed email', async () => {
    const service = buildService(dataLayer);

    await expect(
      service.create('school-st-marys', 'INQUIRY', 'MANUAL', {
        lastName: 'Santos',
        email: 'ben.santos@example.com',
        message: 'Hello'
      })
    ).rejects.toThrow('First name is required.');

    await expect(
      service.create('school-st-marys', 'INQUIRY', 'MANUAL', {
        firstName: 'Ben',
        lastName: 'Santos',
        email: 'not-an-email',
        message: 'Hello'
      })
    ).rejects.toThrow('A valid email address is required.');
  });

  it('rejects fields over the max length', async () => {
    const service = buildService(dataLayer);

    await expect(
      service.create('school-st-marys', 'INQUIRY', 'MANUAL', {
        firstName: 'B'.repeat(256),
        lastName: 'Santos',
        email: 'ben.santos@example.com',
        message: 'Hello'
      })
    ).rejects.toThrow('First name must be 255 characters or fewer.');

    await expect(
      service.create('school-st-marys', 'INQUIRY', 'MANUAL', {
        firstName: 'Ben',
        lastName: 'Santos',
        email: 'ben.santos@example.com',
        message: 'M'.repeat(2001)
      })
    ).rejects.toThrow('Message must be 2000 characters or fewer.');
  });

  it('throws when the school does not exist', async () => {
    const service = buildService(dataLayer);

    await expect(
      service.create('school-unknown', 'INQUIRY', 'MANUAL', {
        firstName: 'Ben',
        lastName: 'Santos',
        email: 'ben.santos@example.com',
        message: 'Hello'
      })
    ).rejects.toThrow('School not found.');
  });

  it('createPublic rejects with a 404 DomainError when the feature is disabled', async () => {
    const repositories = createRepositories(dataLayer);
    const service = new SubmissionService(repositories.submissionRepository, repositories.tenantRepository);
    const school = await repositories.tenantRepository.findSchoolById('school-golden');

    await expect(
      service.createPublic(school!, 'INQUIRY', {
        firstName: 'Ben',
        lastName: 'Santos',
        email: 'ben.santos@example.com',
        message: 'Hello'
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('createPublic creates a PUBLIC-sourced submission when the feature is enabled', async () => {
    const repositories = createRepositories(dataLayer);
    const service = new SubmissionService(repositories.submissionRepository, repositories.tenantRepository);
    const school = await repositories.tenantRepository.findSchoolById('school-st-marys');

    const submission = await service.createPublic(school!, 'ENROLLMENT', {
      firstName: 'Cara',
      lastName: 'Dela Cruz',
      email: 'cara@example.com',
      gradeLevelApplying: 'Grade 3'
    });

    expect(submission).toMatchObject({ source: 'PUBLIC', status: 'NEW', type: 'ENROLLMENT' });
  });

  it('updateStatusAndNotes rejects an invalid status and 404s on unknown submissions', async () => {
    const repositories = createRepositories(dataLayer);
    const service = new SubmissionService(repositories.submissionRepository, repositories.tenantRepository);
    const submission = await service.create('school-st-marys', 'INQUIRY', 'MANUAL', {
      firstName: 'Ben',
      lastName: 'Santos',
      email: 'ben.santos@example.com',
      message: 'Hello'
    });

    await expect(
      service.updateStatusAndNotes('school-st-marys', submission.id, { status: 'NOT_A_STATUS' })
    ).rejects.toThrow('Status must be one of: NEW, IN_REVIEW, ACCEPTED, DECLINED.');

    await expect(
      service.updateStatusAndNotes('school-st-marys', 'submission-unknown', { status: 'IN_REVIEW' })
    ).rejects.toMatchObject({ statusCode: 404 });

    const updated = await service.updateStatusAndNotes('school-st-marys', submission.id, {
      status: 'ACCEPTED',
      notes: 'Looks good'
    });
    expect(updated).toMatchObject({ status: 'ACCEPTED', notes: 'Looks good' });
  });

  it('round-trips structured address fields on create', async () => {
    const service = buildService(dataLayer);

    const submission = await service.create('school-st-marys', 'INQUIRY', 'MANUAL', {
      firstName: 'Dana',
      lastName: 'Cruz',
      email: 'dana.cruz@example.com',
      message: 'Hello',
      addressLine1: '18 Sample Street',
      addressLine2: null,
      barangay: 'Poblacion',
      city: 'Makati City',
      province: 'Metro Manila',
      zipCode: '1210'
    });

    expect(submission).toMatchObject({
      addressLine1: '18 Sample Street',
      addressLine2: null,
      barangay: 'Poblacion',
      city: 'Makati City',
      province: 'Metro Manila',
      zipCode: '1210'
    });
  });

  it('rejects a ZIP code over the max length', async () => {
    const service = buildService(dataLayer);

    await expect(
      service.create('school-st-marys', 'INQUIRY', 'MANUAL', {
        firstName: 'Dana',
        lastName: 'Cruz',
        email: 'dana.cruz@example.com',
        message: 'Hello',
        zipCode: '1'.repeat(21)
      })
    ).rejects.toThrow('ZIP code must be 20 characters or fewer.');
  });
});
