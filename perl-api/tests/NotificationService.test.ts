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

describe('NotificationService', () => {
  beforeEach(() => resetMockNotificationTransactions());

  it('sends an admitted student scan to linked guardians and records the provider result', async () => {
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
});
