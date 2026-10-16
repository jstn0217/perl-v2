import { MockAuditRepository, resetMockAuditRecords } from '../src/repositories/mock/MockAuditRepository.js';
import { AuditService } from '../src/services/AuditService.js';
import type { AuditRecord } from '../src/types/Audit.js';

const AUDIT_UNBOUNDED_READ_CAP = 5000;

const seedAuditRecords = async (repository: MockAuditRepository, schoolId: string, count: number) => {
  for (let index = 0; index < count; index += 1) {
    const record: AuditRecord = {
      id: `audit-seed-${index}`,
      schoolId,
      actorUserId: 'user-seed',
      actorRole: 'ADMIN',
      supportInitiated: false,
      action: 'SCHOOL_DATA_VIEWED',
      targetType: 'SCHOOL',
      targetId: schoolId,
      changeSummary: 'viewed school',
      occurredAt: new Date(2026, 0, 1, 0, 0, index).toISOString()
    };
    await repository.create(record);
  }
};

describe('AuditService unbounded-read cap', () => {
  beforeEach(() => resetMockAuditRecords());

  it('caps findAll at the hard limit so a school with more records never loads them all into memory', async () => {
    const repository = new MockAuditRepository();
    await seedAuditRecords(repository, 'school-cap-test', AUDIT_UNBOUNDED_READ_CAP + 50);

    const records = await repository.findAll('school-cap-test');

    expect(records.length).toBe(AUDIT_UNBOUNDED_READ_CAP);
  });

  it('requires a date range once a school has hit the cap and no range was given', async () => {
    const repository = new MockAuditRepository();
    const service = new AuditService(repository);
    await seedAuditRecords(repository, 'school-cap-test', AUDIT_UNBOUNDED_READ_CAP);

    await expect(service.exportFilteredRecords({}, 'school-cap-test')).rejects.toThrow(
      /provide a from\/to date range/
    );
  });

  it('still returns records when a date range narrows the query, even over the cap', async () => {
    const repository = new MockAuditRepository();
    const service = new AuditService(repository);
    await seedAuditRecords(repository, 'school-cap-test', AUDIT_UNBOUNDED_READ_CAP);

    await expect(
      service.exportFilteredRecords({ from: '2020-01-01T00:00:00.000Z', to: '2030-01-01T00:00:00.000Z' }, 'school-cap-test')
    ).resolves.toBeInstanceOf(Array);
  });
});
