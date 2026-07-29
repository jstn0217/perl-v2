import { randomUUID } from 'node:crypto';
import type { IAuditRepository } from '../repositories/interfaces/IAuditRepository.js';
import type { AuditAction, AuditFilters, AuditPage, AuditRecord } from '../types/Audit.js';
import type { SessionUser } from '../types/User.js';
import { isPlatformRole } from '../auth/permissions.js';

export class AuditService {
  constructor(private readonly auditRepository: IAuditRepository) {}

  async record(
    schoolId: string,
    actor: SessionUser,
    action: AuditAction,
    targetType: AuditRecord['targetType'],
    targetId: string | null,
    changeSummary = action.replaceAll('_', ' ').toLowerCase()
  ): Promise<AuditRecord> {
    return this.auditRepository.create({
      id: `audit-${randomUUID()}`,
      schoolId,
      actorUserId: actor.id,
      actorRole: actor.role,
      supportInitiated: isPlatformRole(actor.role),
      action,
      targetType,
      targetId,
      changeSummary,
      occurredAt: new Date().toISOString()
    });
  }

  async listSchoolRecords(schoolId: string, page: number, pageSize: number): Promise<AuditPage> {
    return this.auditRepository.listBySchool(schoolId, page, pageSize);
  }

  async listAllRecords(page: number, pageSize: number, schoolId?: string): Promise<AuditPage> {
    return this.auditRepository.listAll(page, pageSize, schoolId);
  }

  async listFilteredRecords(
    page: number,
    pageSize: number,
    filters: AuditFilters,
    schoolId?: string
  ): Promise<AuditPage> {
    const records = await this.exportFilteredRecords(filters, schoolId);
    const start = (page - 1) * pageSize;
    return {
      records: records.slice(start, start + pageSize),
      total: records.length,
      page,
      pageSize
    };
  }

  async exportFilteredRecords(filters: AuditFilters, schoolId?: string): Promise<AuditRecord[]> {
    const records = await this.auditRepository.findAll(schoolId);
    const search = filters.search?.trim().toLocaleLowerCase();

    return records.filter((record) => {
      if (filters.action && record.action !== filters.action) return false;
      if (filters.actorRole && record.actorRole !== filters.actorRole) return false;
      if (
        filters.supportInitiated !== undefined &&
        record.supportInitiated !== filters.supportInitiated
      ) return false;
      if (filters.targetType && record.targetType !== filters.targetType) return false;
      if (filters.from && Date.parse(record.occurredAt) < Date.parse(filters.from)) return false;
      if (filters.to && Date.parse(record.occurredAt) > Date.parse(filters.to)) return false;
      if (
        search &&
        ![
          record.action,
          record.actorUserId,
          record.actorRole,
          record.targetType,
          record.targetId,
          record.changeSummary
        ]
          .filter(Boolean)
          .some((value) => value?.toLocaleLowerCase().includes(search))
      ) return false;
      return true;
    });
  }
}
