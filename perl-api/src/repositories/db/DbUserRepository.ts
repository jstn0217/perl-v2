import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { IUserRepository } from '../interfaces/IUserRepository.js';
import type { UserRecord } from '../../types/User.js';
import { mapUserRow, type UserRow } from './mappers.js';
import { getDbPool } from './pool.js';

export class DbUserRepository implements IUserRepository {
  async findByEmail(
    email: string,
    options?: { includeInactive?: boolean }
  ): Promise<UserRecord | null> {
    const [rows] = await getDbPool().query<(UserRow & RowDataPacket)[]>(
      `SELECT id, school_id, email, password_hash, first_name, last_name, role, card_uid,
              grade_level, section, image_url, phone_number, linked_student_ids, is_active
       FROM users
       WHERE email = ? ${options?.includeInactive ? '' : 'AND is_active = 1'}
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
    const [rows] = await getDbPool().query<(UserRow & RowDataPacket)[]>(
      `SELECT id, school_id, email, password_hash, first_name, last_name, role, card_uid,
              grade_level, section, image_url, phone_number, linked_student_ids, is_active
       FROM users
       WHERE email = ? AND school_id = ? ${options?.includeInactive ? '' : 'AND is_active = 1'}
       LIMIT 1`,
      [email.toLowerCase(), schoolId]
    );

    return rows[0] ? mapUserRow(rows[0]) : null;
  }

  async findById(userId: string): Promise<UserRecord | null> {
    const [rows] = await getDbPool().query<(UserRow & RowDataPacket)[]>(
      `SELECT id, school_id, email, password_hash, first_name, last_name, role, card_uid,
              grade_level, section, image_url, phone_number, linked_student_ids, is_active
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );

    return rows[0] ? mapUserRow(rows[0]) : null;
  }

  async findByCardUid(cardUid: string, options?: { includeInactive?: boolean }): Promise<UserRecord | null> {
    const [rows] = await getDbPool().query<(UserRow & RowDataPacket)[]>(
      `SELECT id, school_id, email, password_hash, first_name, last_name, role, card_uid,
              grade_level, section, image_url, phone_number, linked_student_ids, is_active
       FROM users
       WHERE card_uid = ? ${options?.includeInactive ? '' : 'AND is_active = 1'}
       LIMIT 1`,
      [cardUid]
    );

    return rows[0] ? mapUserRow(rows[0]) : null;
  }

  async findStudentByCardUid(cardUid: string): Promise<UserRecord | null> {
    const [rows] = await getDbPool().query<(UserRow & RowDataPacket)[]>(
      `SELECT id, school_id, email, password_hash, first_name, last_name, role, card_uid,
              grade_level, section, image_url, phone_number, linked_student_ids, is_active
       FROM users
       WHERE card_uid = ? AND role = 'STUDENT' AND is_active = 1
       LIMIT 1`,
      [cardUid]
    );

    return rows[0] ? mapUserRow(rows[0]) : null;
  }

  async listBySchool(schoolId: string): Promise<UserRecord[]> {
    const [rows] = await getDbPool().query<(UserRow & RowDataPacket)[]>(
      `SELECT id, school_id, email, password_hash, first_name, last_name, role, card_uid,
              grade_level, section, image_url, phone_number, linked_student_ids, is_active
       FROM users
       WHERE school_id = ?
       ORDER BY created_at ASC, id ASC`,
      [schoolId]
    );

    return rows.map(mapUserRow);
  }

  async create(user: UserRecord): Promise<UserRecord> {
    await getDbPool().query(
      `INSERT INTO users (
        id, school_id, email, password_hash, first_name, last_name, role, card_uid,
        grade_level, section, image_url, phone_number, linked_student_ids, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        user.section,
        user.imageUrl,
        user.phoneNumber ?? null,
        JSON.stringify(user.linkedStudentIds ?? []),
        user.isActive ? 1 : 0
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
      section: changes.section !== undefined ? changes.section : existing.section,
      imageUrl: changes.imageUrl !== undefined ? changes.imageUrl : existing.imageUrl,
      phoneNumber:
        changes.phoneNumber !== undefined ? changes.phoneNumber : existing.phoneNumber ?? null,
      linkedStudentIds:
        changes.linkedStudentIds !== undefined ? changes.linkedStudentIds : existing.linkedStudentIds ?? [],
      isActive: changes.isActive ?? existing.isActive
    };

    await getDbPool().query(
      `UPDATE users
       SET email = ?, password_hash = ?, first_name = ?, last_name = ?, role = ?, card_uid = ?,
           grade_level = ?, section = ?, image_url = ?, phone_number = ?, linked_student_ids = ?, is_active = ?
       WHERE id = ? AND school_id = ?`,
      [
        next.email.toLowerCase(),
        next.passwordHash,
        next.firstName,
        next.lastName,
        next.role,
        next.cardUid,
        next.gradeLevel,
        next.section,
        next.imageUrl,
        next.phoneNumber,
        JSON.stringify(next.linkedStudentIds),
        next.isActive ? 1 : 0,
        userId,
        schoolId
      ]
    );

    return this.findById(userId);
  }

  async deactivate(userId: string, schoolId: string): Promise<UserRecord | null> {
    await getDbPool().query(
      `UPDATE users
       SET is_active = 0
       WHERE id = ? AND school_id = ?`,
      [userId, schoolId]
    );

    return this.findById(userId);
  }

  async delete(userId: string, schoolId: string): Promise<boolean> {
    const [result] = await getDbPool().query<ResultSetHeader>(
      'DELETE FROM users WHERE id = ? AND school_id = ?',
      [userId, schoolId]
    );
    return (result.affectedRows ?? 0) > 0;
  }

  async deleteBySchool(schoolId: string): Promise<number> {
    const [result] = await getDbPool().query<ResultSetHeader>(
      'DELETE FROM users WHERE school_id = ?',
      [schoolId]
    );
    return result.affectedRows ?? 0;
  }

  async deleteBySchoolExcept(schoolId: string, userId: string): Promise<number> {
    const [result] = await getDbPool().query<ResultSetHeader>(
      'DELETE FROM users WHERE school_id = ? AND id <> ?',
      [schoolId, userId]
    );
    return result.affectedRows ?? 0;
  }
}
