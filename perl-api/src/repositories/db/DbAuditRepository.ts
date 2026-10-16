import type { IAuditRepository } from '../interfaces/IAuditRepository.js';
import type { AuditAction, AuditPage, AuditRecord } from '../../types/Audit.js';
import type { UserRole } from '../../types/User.js';
import { getDbPool } from './pool.js';

// Hard cap on unbounded whole-school reads (findAll, used by filtered listing/
// export). Mirrors ATTENDANCE_UNBOUNDED_READ_CAP in DbAttendanceRepository.
// Prevents a single request from loading a school's entire audit history.
const AUDIT_UNBOUNDED_READ_CAP = 5000;

interface AuditRow {
  id: string;
  school_id: string | null;
  actor_user_id: string;
  actor_role: UserRole;
  support_initiated: boolean;
  action: AuditAction;
  target_type: AuditRecord['targetType'];
  target_id: string | null;
  change_summary: string | null;
  occurred_at: Date;
}

const mapAuditRow = (row: AuditRow): AuditRecord => ({
  id: row.id,
  schoolId: row.school_id,
  actorUserId: row.actor_user_id,
  actorRole: row.actor_role ?? 'ADMIN',
  supportInitiated: row.support_initiated,
  action: row.action,
  targetType: row.target_type,
  targetId: row.target_id,
  changeSummary: row.change_summary ?? row.action.replaceAll('_', ' ').toLowerCase(),
  occurredAt: row.occurred_at.toISOString()
});

export class DbAuditRepository implements IAuditRepository {
  async create(record: AuditRecord): Promise<AuditRecord> {
    await getDbPool().query(
      `INSERT INTO audit_logs (
        id, school_id, actor_user_id, actor_role, support_initiated, action,
        target_type, target_id, change_summary, occurred_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        record.id,
        record.schoolId,
        record.actorUserId,
        record.actorRole,
        record.supportInitiated,
        record.action,
        record.targetType,
        record.targetId,
        record.changeSummary,
        record.occurredAt
      ]
    );

    return record;
  }

  async findAll(schoolId?: string): Promise<AuditRecord[]> {
    const whereClause = schoolId ? 'WHERE school_id = $1' : '';
    const limitPlaceholder = schoolId ? '$2' : '$1';
    const parameters = schoolId ? [schoolId, AUDIT_UNBOUNDED_READ_CAP] : [AUDIT_UNBOUNDED_READ_CAP];
    const { rows } = await getDbPool().query<AuditRow>(
      `SELECT id, school_id, actor_user_id, actor_role, support_initiated, action,
              target_type, target_id, change_summary, occurred_at
       FROM audit_logs
       ${whereClause}
       ORDER BY occurred_at DESC, created_at DESC, id DESC
       LIMIT ${limitPlaceholder}`,
      parameters
    );
    return rows.map(mapAuditRow);
  }

  async listBySchool(schoolId: string, page: number, pageSize: number): Promise<AuditPage> {
    const offset = (page - 1) * pageSize;
    const pool = getDbPool();
    const { rows } = await pool.query<AuditRow>(
      `SELECT id, school_id, actor_user_id, actor_role, support_initiated, action,
              target_type, target_id, change_summary, occurred_at
       FROM audit_logs
       WHERE school_id = $1
       ORDER BY occurred_at DESC, created_at DESC, id DESC
       LIMIT $2 OFFSET $3`,
      [schoolId, pageSize, offset]
    );
    const { rows: countRows } = await pool.query<{ total: string }>(
      'SELECT COUNT(*) AS total FROM audit_logs WHERE school_id = $1',
      [schoolId]
    );

    return {
      records: rows.map(mapAuditRow),
      total: Number(countRows[0]?.total ?? 0),
      page,
      pageSize
    };
  }

  async listAll(page: number, pageSize: number, schoolId?: string): Promise<AuditPage> {
    const offset = (page - 1) * pageSize;
    const pool = getDbPool();
    const whereClause = schoolId ? 'WHERE school_id = $1' : '';
    const parameters = schoolId ? [schoolId, pageSize, offset] : [pageSize, offset];
    const limitPlaceholder = schoolId ? '$2' : '$1';
    const offsetPlaceholder = schoolId ? '$3' : '$2';
    const { rows } = await pool.query<AuditRow>(
      `SELECT id, school_id, actor_user_id, actor_role, support_initiated, action,
              target_type, target_id, change_summary, occurred_at
       FROM audit_logs
       ${whereClause}
       ORDER BY occurred_at DESC, created_at DESC, id DESC
       LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
      parameters
    );
    const { rows: countRows } = await pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM audit_logs ${whereClause}`,
      schoolId ? [schoolId] : []
    );

    return {
      records: rows.map(mapAuditRow),
      total: Number(countRows[0]?.total ?? 0),
      page,
      pageSize
    };
  }
}
