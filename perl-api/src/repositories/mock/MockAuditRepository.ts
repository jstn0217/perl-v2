import type { AuditPage, AuditRecord } from '../../types/Audit.js';
import type { IAuditRepository } from '../interfaces/IAuditRepository.js';

let auditRecords: AuditRecord[] = [];

export const resetMockAuditRecords = () => {
  auditRecords = [];
};

export class MockAuditRepository implements IAuditRepository {
  async create(record: AuditRecord): Promise<AuditRecord> {
    if (auditRecords.some((entry) => entry.id === record.id)) {
      throw new Error('An audit record with that ID already exists.');
    }

    auditRecords.unshift(record);
    return record;
  }

  async findAll(schoolId?: string): Promise<AuditRecord[]> {
    return schoolId
      ? auditRecords.filter((record) => record.schoolId === schoolId)
      : [...auditRecords];
  }

  async listBySchool(schoolId: string, page: number, pageSize: number): Promise<AuditPage> {
    const schoolRecords = auditRecords.filter((record) => record.schoolId === schoolId);
    const start = (page - 1) * pageSize;

    return {
      records: schoolRecords.slice(start, start + pageSize),
      total: schoolRecords.length,
      page,
      pageSize
    };
  }

  async listAll(page: number, pageSize: number, schoolId?: string): Promise<AuditPage> {
    const filtered = schoolId
      ? auditRecords.filter((record) => record.schoolId === schoolId)
      : auditRecords;
    const start = (page - 1) * pageSize;

    return {
      records: filtered.slice(start, start + pageSize),
      total: filtered.length,
      page,
      pageSize
    };
  }
}
