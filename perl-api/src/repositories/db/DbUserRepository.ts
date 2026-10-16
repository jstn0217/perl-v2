import type { IUserRepository, UserListQuery } from '../interfaces/IUserRepository.js';
import type { PagedResult } from '../../types/Pagination.js';
import type { UserRecord } from '../../types/User.js';
import { mapUserRow, type UserRow } from './mappers.js';
import { getDbPool } from './pool.js';

const userOrderClause = (sort: string | undefined, dir: string | undefined) => {
  const direction = dir === 'desc' ? 'DESC' : 'ASC';

  switch (sort) {
    case 'email':
      return `email ${direction}, id ${direction}`;
    case 'role':
      return `role ${direction}, id ${direction}`;
    case 'status':
      return `is_active ${direction}, id ${direction}`;
    case 'createdAt':
      return `created_at ${direction}, id ${direction}`;
    case 'name':
    default:
      return `last_name ${direction}, first_name ${direction}, id ${direction}`;
  }
};

export class DbUserRepository implements IUserRepository {
  async findByEmail(
    email: string,
    options?: { includeInactive?: boolean }
  ): Promise<UserRecord | null> {
    const { rows } = await getDbPool().query<UserRow>(
      `SELECT id, school_id, email, password_hash, first_name, last_name, role, card_uid,
              grade_level, school_id_number, section, image_url, phone_number, linked_student_ids, is_active, role_definition_id,
              address_line1, address_line2, barangay, city, province, zip_code
       FROM users
       WHERE email = $1 ${options?.includeInactive ? '' : 'AND is_active = TRUE'}
       LIMIT 2`,
      [email.toLowerCase()]
    );

    if (rows.length > 1) {
      throw new Error('Multiple school accounts use this email. Contact system support.');
    }

    return rows[0] ? mapUserRow(rows[0]) : null;
  }

  async findByEmailAndSchool(
    email: string,
    schoolId: string,
    options?: { includeInactive?: boolean }
  ): Promise<UserRecord | null> {
    const { rows } = await getDbPool().query<UserRow>(
      `SELECT id, school_id, email, password_hash, first_name, last_name, role, card_uid,
              grade_level, school_id_number, section, image_url, phone_number, linked_student_ids, is_active, role_definition_id,
              address_line1, address_line2, barangay, city, province, zip_code
       FROM users
       WHERE email = $1 AND school_id = $2 ${options?.includeInactive ? '' : 'AND is_active = TRUE'}
       LIMIT 1`,
      [email.toLowerCase(), schoolId]
    );

    return rows[0] ? mapUserRow(rows[0]) : null;
  }

  async findById(userId: string): Promise<UserRecord | null> {
    const { rows } = await getDbPool().query<UserRow>(
      `SELECT id, school_id, email, password_hash, first_name, last_name, role, card_uid,
              grade_level, school_id_number, section, image_url, phone_number, linked_student_ids, is_active, role_definition_id,
              address_line1, address_line2, barangay, city, province, zip_code
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );

    return rows[0] ? mapUserRow(rows[0]) : null;
  }

  async findByCardUid(cardUid: string, options?: { includeInactive?: boolean }): Promise<UserRecord | null> {
    const { rows } = await getDbPool().query<UserRow>(
      `SELECT id, school_id, email, password_hash, first_name, last_name, role, card_uid,
              grade_level, school_id_number, section, image_url, phone_number, linked_student_ids, is_active, role_definition_id,
              address_line1, address_line2, barangay, city, province, zip_code
       FROM users
       WHERE card_uid = $1 ${options?.includeInactive ? '' : 'AND is_active = TRUE'}
       LIMIT 1`,
      [cardUid]
    );

    return rows[0] ? mapUserRow(rows[0]) : null;
  }

  async findStudentByCardUid(cardUid: string): Promise<UserRecord | null> {
    const { rows } = await getDbPool().query<UserRow>(
      `SELECT id, school_id, email, password_hash, first_name, last_name, role, card_uid,
              grade_level, school_id_number, section, image_url, phone_number, linked_student_ids, is_active, role_definition_id,
              address_line1, address_line2, barangay, city, province, zip_code
       FROM users
       WHERE card_uid = $1 AND role = 'STUDENT' AND is_active = TRUE
       LIMIT 1`,
      [cardUid]
    );

    return rows[0] ? mapUserRow(rows[0]) : null;
  }

  async findBySchoolIdNumber(
    schoolId: string,
    schoolIdNumber: string,
    options?: { includeInactive?: boolean }
  ): Promise<UserRecord | null> {
    const { rows } = await getDbPool().query<UserRow>(
      `SELECT id, school_id, email, password_hash, first_name, last_name, role, card_uid,
              grade_level, school_id_number, section, image_url, phone_number, linked_student_ids, is_active, role_definition_id,
              address_line1, address_line2, barangay, city, province, zip_code
       FROM users
       WHERE school_id = $1 AND school_id_number = $2 ${options?.includeInactive ? '' : 'AND is_active = TRUE'}
       LIMIT 1`,
      [schoolId, schoolIdNumber]
    );

    return rows[0] ? mapUserRow(rows[0]) : null;
  }

  async listBySchool(schoolId: string): Promise<UserRecord[]> {
    const { rows } = await getDbPool().query<UserRow>(
      `SELECT id, school_id, email, password_hash, first_name, last_name, role, card_uid,
              grade_level, school_id_number, section, image_url, phone_number, linked_student_ids, is_active, role_definition_id,
              address_line1, address_line2, barangay, city, province, zip_code
       FROM users
       WHERE school_id = $1
       ORDER BY created_at ASC, id ASC`,
      [schoolId]
    );

    return rows.map(mapUserRow);
  }

  async listBySchoolPaged(schoolId: string, query: UserListQuery): Promise<PagedResult<UserRecord>> {
    const conditions: string[] = ['school_id = $1'];
    const params: unknown[] = [schoolId];

    if (query.role) {
      params.push(query.role);
      conditions.push(`role = $${params.length}`);
    }

    if (query.status === 'active') {
      conditions.push('is_active = TRUE');
    } else if (query.status === 'inactive') {
      conditions.push('is_active = FALSE');
    }

    const search = query.search?.trim();
    if (search) {
      params.push(`%${search}%`);
      const placeholder = `$${params.length}`;
      conditions.push(
        `(email ILIKE ${placeholder} OR first_name ILIKE ${placeholder} OR last_name ILIKE ${placeholder}
          OR card_uid ILIKE ${placeholder} OR section ILIKE ${placeholder})`
      );
    }

    const whereClause = conditions.join(' AND ');
    const orderClause = userOrderClause(query.sort, query.dir);
    const pool = getDbPool();

    const listParams = [...params, query.pageSize, (query.page - 1) * query.pageSize];
    const { rows } = await pool.query<UserRow>(
      `SELECT id, school_id, email, password_hash, first_name, last_name, role, card_uid,
              grade_level, school_id_number, section, image_url, phone_number, linked_student_ids, is_active, role_definition_id,
              address_line1, address_line2, barangay, city, province, zip_code
       FROM users
       WHERE ${whereClause}
       ORDER BY ${orderClause}
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );

    const { rows: countRows } = await pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM users WHERE ${whereClause}`,
      params
    );

    return { items: rows.map(mapUserRow), total: Number(countRows[0]?.total ?? 0) };
  }

  async create(user: UserRecord): Promise<UserRecord> {
    await getDbPool().query(
      `INSERT INTO users (
        id, school_id, email, password_hash, first_name, last_name, role, card_uid,
        grade_level, school_id_number, section, image_url, phone_number, linked_student_ids, is_active, role_definition_id,
        address_line1, address_line2, barangay, city, province, zip_code
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
      [
        user.id,
        user.schoolId,
        user.email.toLowerCase(),
        user.passwordHash,
        user.firstName,
        user.lastName,
        user.role,
        user.cardUid,
        user.gradeLevel,
        user.schoolIdNumber,
        user.section,
        user.imageUrl,
        user.phoneNumber ?? null,
        JSON.stringify(user.linkedStudentIds ?? []),
        user.isActive,
        user.roleDefinitionId ?? null,
        user.addressLine1,
        user.addressLine2,
        user.barangay,
        user.city,
        user.province,
        user.zipCode
      ]
    );

    return user;
  }

  async update(userId: string, schoolId: string, changes: Partial<UserRecord>): Promise<UserRecord | null> {
    const existing = await this.findById(userId);

    if (!existing || existing.schoolId !== schoolId) {
      return null;
    }

    const next = {
      email: changes.email ?? existing.email,
      passwordHash: changes.passwordHash ?? existing.passwordHash,
      firstName: changes.firstName ?? existing.firstName,
      lastName: changes.lastName ?? existing.lastName,
      role: changes.role ?? existing.role,
      cardUid: changes.cardUid !== undefined ? changes.cardUid : existing.cardUid,
      gradeLevel: changes.gradeLevel !== undefined ? changes.gradeLevel : existing.gradeLevel,
      schoolIdNumber: changes.schoolIdNumber !== undefined ? changes.schoolIdNumber : existing.schoolIdNumber,
      section: changes.section !== undefined ? changes.section : existing.section,
      imageUrl: changes.imageUrl !== undefined ? changes.imageUrl : existing.imageUrl,
      phoneNumber:
        changes.phoneNumber !== undefined ? changes.phoneNumber : existing.phoneNumber ?? null,
      linkedStudentIds:
        changes.linkedStudentIds !== undefined ? changes.linkedStudentIds : existing.linkedStudentIds ?? [],
      isActive: changes.isActive ?? existing.isActive,
      roleDefinitionId:
        changes.roleDefinitionId !== undefined ? changes.roleDefinitionId : existing.roleDefinitionId ?? null,
      addressLine1: changes.addressLine1 !== undefined ? changes.addressLine1 : existing.addressLine1,
      addressLine2: changes.addressLine2 !== undefined ? changes.addressLine2 : existing.addressLine2,
      barangay: changes.barangay !== undefined ? changes.barangay : existing.barangay,
      city: changes.city !== undefined ? changes.city : existing.city,
      province: changes.province !== undefined ? changes.province : existing.province,
      zipCode: changes.zipCode !== undefined ? changes.zipCode : existing.zipCode
    };

    await getDbPool().query(
      `UPDATE users
       SET email = $1, password_hash = $2, first_name = $3, last_name = $4, role = $5, card_uid = $6,
           grade_level = $7, school_id_number = $8, section = $9, image_url = $10, phone_number = $11,
           linked_student_ids = $12, is_active = $13, role_definition_id = $14,
           address_line1 = $15, address_line2 = $16, barangay = $17, city = $18, province = $19, zip_code = $20
       WHERE id = $21 AND school_id = $22`,
      [
        next.email.toLowerCase(),
        next.passwordHash,
        next.firstName,
        next.lastName,
        next.role,
        next.cardUid,
        next.gradeLevel,
        next.schoolIdNumber,
        next.section,
        next.imageUrl,
        next.phoneNumber,
        JSON.stringify(next.linkedStudentIds),
        next.isActive,
        next.roleDefinitionId,
        next.addressLine1,
        next.addressLine2,
        next.barangay,
        next.city,
        next.province,
        next.zipCode,
        userId,
        schoolId
      ]
    );

    return this.findById(userId);
  }

  async deactivate(userId: string, schoolId: string): Promise<UserRecord | null> {
    await getDbPool().query(
      `UPDATE users
       SET is_active = FALSE
       WHERE id = $1 AND school_id = $2`,
      [userId, schoolId]
    );

    return this.findById(userId);
  }

  async delete(userId: string, schoolId: string): Promise<boolean> {
    const result = await getDbPool().query(
      'DELETE FROM users WHERE id = $1 AND school_id = $2',
      [userId, schoolId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async deleteBySchool(schoolId: string): Promise<number> {
    const result = await getDbPool().query(
      'DELETE FROM users WHERE school_id = $1',
      [schoolId]
    );
    return result.rowCount ?? 0;
  }

  async deleteBySchoolExcept(schoolId: string, userId: string): Promise<number> {
    const result = await getDbPool().query(
      'DELETE FROM users WHERE school_id = $1 AND id <> $2',
      [schoolId, userId]
    );
    return result.rowCount ?? 0;
  }

  async countByRoleDefinitionId(roleDefinitionId: string): Promise<number> {
    const { rows } = await getDbPool().query<{ total: string }>(
      'SELECT COUNT(*) AS total FROM users WHERE role_definition_id = $1',
      [roleDefinitionId]
    );
    return Number(rows[0]?.total ?? 0);
  }
}
