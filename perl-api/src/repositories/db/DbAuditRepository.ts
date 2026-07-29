import type { RowDataPacket } from 'mysql2';
import type { IAuditRepository } from '../interfaces/IAuditRepository.js';
import type { AuditAction, AuditPage, AuditRecord } from '../../types/Audit.js';
import type { UserRole } from '../../types/User.js';
import { getDbPool } from './pool.js';

interface AuditRow {
  id: string;
  school_id: string;
  actor_user_id: string;
  actor_role: UserRole;
  support_initiated: number;
  action: AuditAction;
  target_type: AuditRecord['targetType'];
  target_id: string | null;
  change_summary: string | null;
  occurred_at: Date | string;
}

const toIsoString = (value: Date | string) => {
  if (value instanceof Date) return value.toISOString();
  return new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`).toISOString();
};

const mapAuditRow = (row: AuditRow): AuditRecord => ({
  id: row.id,
  schoolId: row.school_id,
  actorUserId: row.actor_user_id,
  actorRole: row.actor_role ?? 'ADMIN',
  supportInitiated: Boolean(row.support_initiated),
  action: row.action,
  targetType: row.target_type,
  targetId: row.target_id,
  changeSummary: row.change_summary ?? row.action.replaceAll('_', ' ').toLowerCase(),
  occurredAt: toIsoString(row.occurred_at)
});

export class DbAuditRepository implements IAuditRepository {
  async create(record: AuditRecord): Promise<AuditRecord> {
    await getDbPool().query(
      `INSERT INTO audit_logs (
        id, school_id, actor_user_id, actor_role, support_initiated, action,
        target_type, target_id, change_summary, occurred_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.schoolId,
        record.actorUserId,
        record.actorRole,
        record.supportInitiated ? 1 : 0,
        record.action,
        record.targetType,
        record.targetId,
        record.changeSummary,
        record.occurredAt.replace('T', ' ').replace('Z', '')
      ]
    );

    return record;
  }

  async findAll(schoolId?: string): Promise<AuditRecord[]> {
    const whereClause = schoolId ? 'WHERE school_id = ?' : '';
    const [rows] = await getDbPool().query<(AuditRow & RowDataPacket)[]>(
      `SELECT id, school_id, actor_user_id, actor_role, support_initiated, action,
              target_type, target_id, change_summary, occurred_at
       FROM audit_logs
       ${whereClause}
       ORDER BY occurred_at DESC, created_at DESC, id DESC`,
      schoolId ? [schoolId] : []
    );
    return rows.map(mapAuditRow);
  }

  async listBySchool(schoolId: string, page: number, pageSize: number): Promise<AuditPage> {
    const offset = (page - 1) * pageSize;
    const pool = getDbPool();
    const [rows] = await pool.query<(AuditRow & RowDataPacket)[]>(
      `SELECT id, school_id, actor_user_id, actor_role, support_initiated, action,
              target_type, target_id, change_summary, occurred_at
       FROM audit_logs
       WHERE school_id = ?
       ORDER BY occurred_at DESC, created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [schoolId, pageSize, offset]
    );
    const [countRows] = await pool.query<(RowDataPacket & { total: number })[]>(
      'SELECT COUNT(*) AS total FROM audit_logs WHERE school_id = ?',
      [schoolId]
    );

    return {
      records: rows.map(mapAuditRow),
      total: countRows[0]?.total ?? 0,
      page,
      pageSize
    };
  }

  async listAll(page: number, pageSize: number, schoolId?: string): Promise<AuditPage> {
    const offset = (page - 1) * pageSize;
    const pool = getDbPool();
    const whereClause = schoolId ? 'WHERE school_id = ?' : '';
    const parameters = schoolId ? [schoolId, pageSize, offset] : [pageSize, offset];
    const [rows] = await pool.query<(AuditRow & RowDataPacket)[]>(
      `SELECT id, school_id, actor_user_id, actor_role, support_initiated, action,
              target_type, target_id, change_summary, occurred_at
       FROM audit_logs
       ${whereClause}
       ORDER BY occurred_at DESC, created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      parameters
    );
    const [countRows] = await pool.query<(RowDataPacket & { total: number })[]>(
      `SELECT COUNT(*) AS total FROM audit_logs ${whereClause}`,
      schoolId ? [schoolId] : []
    );

    return {
      records: rows.map(mapAuditRow),
      total: countRows[0]?.total ?? 0,
      page,
      pageSize
    };
  }
}
