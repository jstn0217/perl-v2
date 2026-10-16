import type { ISubmissionRepository, SubmissionListQuery } from '../interfaces/ISubmissionRepository.js';
import type { PagedResult } from '../../types/Pagination.js';
import type { SubmissionRecord } from '../../types/Submission.js';
import { mapSubmissionRow, type SubmissionRow } from './mappers.js';
import { getDbPool } from './pool.js';

const submissionColumns = `id, school_id, type, status, source, first_name, last_name, email, phone,
       grade_level_applying, guardian_name, message, notes, created_at, updated_at,
       address_line1, address_line2, barangay, city, province, zip_code`;

const submissionOrderClause = (sort: string | undefined, dir: string | undefined) => {
  const direction = dir === 'asc' ? 'ASC' : 'DESC';

  switch (sort) {
    case 'name':
      return `last_name ${direction}, first_name ${direction}, id ${direction}`;
    case 'status':
      return `status ${direction}, id ${direction}`;
    case 'createdAt':
    default:
      return `created_at ${direction}, id ${direction}`;
  }
};

export class DbSubmissionRepository implements ISubmissionRepository {
  async create(record: SubmissionRecord): Promise<SubmissionRecord> {
    await getDbPool().query(
      `INSERT INTO school_submissions (
        id, school_id, type, status, source, first_name, last_name, email, phone,
        grade_level_applying, guardian_name, message, notes, created_at, updated_at,
        address_line1, address_line2, barangay, city, province, zip_code
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
      [
        record.id,
        record.schoolId,
        record.type,
        record.status,
        record.source,
        record.firstName,
        record.lastName,
        record.email,
        record.phone,
        record.gradeLevelApplying,
        record.guardianName,
        record.message,
        record.notes,
        record.createdAt,
        record.updatedAt,
        record.addressLine1,
        record.addressLine2,
        record.barangay,
        record.city,
        record.province,
        record.zipCode
      ]
    );

    return record;
  }

  async findById(schoolId: string, id: string): Promise<SubmissionRecord | null> {
    const { rows } = await getDbPool().query<SubmissionRow>(
      `SELECT ${submissionColumns} FROM school_submissions WHERE id = $1 AND school_id = $2 LIMIT 1`,
      [id, schoolId]
    );

    return rows[0] ? mapSubmissionRow(rows[0]) : null;
  }

  async listBySchoolPaged(
    schoolId: string,
    query: SubmissionListQuery
  ): Promise<PagedResult<SubmissionRecord>> {
    const conditions: string[] = ['school_id = $1'];
    const params: unknown[] = [schoolId];

    if (query.type) {
      params.push(query.type);
      conditions.push(`type = $${params.length}`);
    }

    if (query.status) {
      params.push(query.status);
      conditions.push(`status = $${params.length}`);
    }

    const search = query.search?.trim();
    if (search) {
      params.push(`%${search}%`);
      const placeholder = `$${params.length}`;
      conditions.push(
        `(email ILIKE ${placeholder} OR first_name ILIKE ${placeholder} OR last_name ILIKE ${placeholder}
          OR guardian_name ILIKE ${placeholder})`
      );
    }

    const whereClause = conditions.join(' AND ');
    const orderClause = submissionOrderClause(query.sort, query.dir);
    const pool = getDbPool();

    const listParams = [...params, query.pageSize, (query.page - 1) * query.pageSize];
    const { rows } = await pool.query<SubmissionRow>(
      `SELECT ${submissionColumns}
       FROM school_submissions
       WHERE ${whereClause}
       ORDER BY ${orderClause}
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );

    const { rows: countRows } = await pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM school_submissions WHERE ${whereClause}`,
      params
    );

    return { items: rows.map(mapSubmissionRow), total: Number(countRows[0]?.total ?? 0) };
  }

  async listAllBySchool(schoolId: string): Promise<SubmissionRecord[]> {
    const { rows } = await getDbPool().query<SubmissionRow>(
      `SELECT ${submissionColumns} FROM school_submissions WHERE school_id = $1 ORDER BY created_at ASC, id ASC`,
      [schoolId]
    );

    return rows.map(mapSubmissionRow);
  }

  async update(
    schoolId: string,
    id: string,
    changes: Partial<SubmissionRecord>
  ): Promise<SubmissionRecord | null> {
    const existing = await this.findById(schoolId, id);

    if (!existing) {
      return null;
    }

    const next = {
      status: changes.status ?? existing.status,
      notes: changes.notes !== undefined ? changes.notes : existing.notes,
      updatedAt: changes.updatedAt ?? new Date().toISOString()
    };

    await getDbPool().query(
      `UPDATE school_submissions SET status = $1, notes = $2, updated_at = $3 WHERE id = $4 AND school_id = $5`,
      [next.status, next.notes, next.updatedAt, id, schoolId]
    );

    return this.findById(schoolId, id);
  }

  async deleteBySchool(schoolId: string): Promise<number> {
    const result = await getDbPool().query('DELETE FROM school_submissions WHERE school_id = $1', [schoolId]);
    return result.rowCount ?? 0;
  }
}
