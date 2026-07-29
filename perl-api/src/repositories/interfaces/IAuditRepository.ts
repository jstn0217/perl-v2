import type { AuditPage, AuditRecord } from '../../types/Audit.js';

export interface IAuditRepository {
  create(record: AuditRecord): Promise<AuditRecord>;
  findAll(schoolId?: string): Promise<AuditRecord[]>;
  listBySchool(schoolId: string, page: number, pageSize: number): Promise<AuditPage>;
  listAll(page: number, pageSize: number, schoolId?: string): Promise<AuditPage>;
}
