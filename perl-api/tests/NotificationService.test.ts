import { MockNotificationRepository, resetMockNotificationTransactions } from '../src/repositories/mock/MockNotificationRepository.js';
import { MockTenantRepository } from '../src/repositories/mock/MockTenantRepository.js';
import { MockUserRepository } from '../src/repositories/mock/MockUserRepository.js';
import { NotificationService } from '../src/services/NotificationService.js';
import { TenantService } from '../src/services/TenantService.js';
import type { ISmsGateway } from '../src/notifications/index.js';

const gateway: ISmsGateway = {
  enabled: true,
  provider: 'MOCK',
  async send(input) {
    return {
      messageId: 'provider-123',
      status: 'Sent',
      network: 'SMART',
      recipient: input.recipient
    };
  }
};

const NOTIFICATION_UNBOUNDED_READ_CAP = 5000;

const seedNotificationTransactions = async (
  repository: MockNotificationRepository,
  schoolId: string,
  count: number
) => {
  for (let index = 0; index < count; index += 1) {
    await repository.create({
      schoolId,
      attendanceLogId: `attendance-seed-${index}`,
      studentUserId: 'user-seed',
      guardianUserId: null,
      recipient: null,
      direction: 'IN',
      message: 'seed message',
      provider: 'MOCK',
      status: 'SKIPPED',
      providerMessageId: null,
      providerStatus: null,
      network: null,
      errorMessage: 'seed',
      createdAt: new Date(2026, 0, 1, 0, 0, index).toISOString(),
      completedAt: null
    });
  }
};

describe('NotificationService', () => {
  beforeEach(() => resetMockNotificationTransactions());

  it('sends an admitted student scan to linked guardians and records the provider result', async () => {
    const repository = new MockNotificationRepository();
    const users = new MockUserRepository();
    const tenantRepository = new MockTenantRepository();
    const tenantService = new TenantService(tenantRepository);
    const service = new NotificationService(repository, users, tenantRepository, gateway, tenantService);
    // Schools default to SMS off; enable it for this school the same way an
    // admin/support user would, via the feature-toggle service path.
    await tenantService.setFeature('school-st-marys', 'sms', true);
    const student = await users.findByCardUid('RFID-STMARYS-001');
    expect(student).not.toBeNull();

    await service.queueStudentAttendance(
      student!,
      'attendance-test-1',
      'IN',
      '2026-07-29T08:00:00.000Z'
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(await repository.listAllBySchool('school-st-marys')).toEqual([
      expect.objectContaining({
        attendanceLogId: 'attendance-test-1',
        recipient: '639171234567',
        status: 'SENT',
        providerMessageId: 'provider-123',
        network: 'SMART'
      })
    ]);
  });

  it('records a skipped transaction when the school subscription is disabled', async () => {
    const repository = new MockNotificationRepository();
    const users = new MockUserRepository();
    const tenantRepository = new MockTenantRepository();
    const service = new NotificationService(
      repository,
      users,
      tenantRepository,
      gateway,
      new TenantService(tenantRepository)
    );
    const student = await users.findByCardUid('RFID-GOLDEN-001');

    await service.queueStudentAttendance(
      student!,
      'attendance-test-2',
      'OUT',
      '2026-07-29T09:00:00.000Z'
    );

    expect(await repository.listAllBySchool('school-golden')).toEqual([
      expect.objectContaining({
        status: 'SKIPPED',
        errorMessage: 'The school SMS subscription is disabled.'
      })
    ]);
  });

  it('caps listAllBySchool at the hard limit so a school with more records never loads them all', async () => {
    const repository = new MockNotificationRepository();
    await seedNotificationTransactions(repository, 'school-cap-test', NOTIFICATION_UNBOUNDED_READ_CAP + 50);

    const records = await repository.listAllBySchool('school-cap-test');

    expect(records.length).toBe(NOTIFICATION_UNBOUNDED_READ_CAP);
  });

  it('requires a date range once a school has hit the cap and no range was given', async () => {
    const repository = new MockNotificationRepository();
    const users = new MockUserRepository();
    const tenantRepository = new MockTenantRepository();
    const service = new NotificationService(
      repository,
      users,
      tenantRepository,
      gateway,
      new TenantService(tenantRepository)
    );
    await seedNotificationTransactions(repository, 'school-cap-test', NOTIFICATION_UNBOUNDED_READ_CAP);

    await expect(service.list('school-cap-test', 1, 20)).rejects.toThrow(
      /provide a from\/to date range/
    );
  });
});
