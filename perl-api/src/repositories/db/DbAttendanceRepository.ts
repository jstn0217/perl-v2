import { randomUUID } from 'node:crypto';
import type { AttendanceLogRecord, AttendanceLogRecordPage } from '../../types/Attendance.js';
import type { IAttendanceRepository } from '../interfaces/IAttendanceRepository.js';
import { mapAttendanceRow, type AttendanceLogRow } from './mappers.js';
import { getDbPool } from './pool.js';

export class DbAttendanceRepository implements IAttendanceRepository {
  async create(log: Omit<AttendanceLogRecord, 'id'>): Promise<AttendanceLogRecord> {
    const id = `attendance-${randomUUID()}`;

    await getDbPool().query(
      `INSERT INTO attendance_logs (
        id, school_id, user_id, device_id, direction, verdict, denial_reason, message, scanned_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        log.schoolId,
        log.userId,
        log.deviceId,
        log.direction,
        log.verdict,
        log.denialReason,
        log.message,
        log.scannedAt
      ]
    );

    return {
      ...log,
      id
    };
  }

  async findByUserAndDate(userId: string, date: string): Promise<AttendanceLogRecord[]> {
    const { rows } = await getDbPool().query<AttendanceLogRow>(
      `SELECT id, school_id, user_id, device_id, direction, verdict, denial_reason, message, scanned_at
       FROM attendance_logs
       WHERE user_id = $1 AND (scanned_at AT TIME ZONE 'UTC')::date = $2::date
       ORDER BY scanned_at DESC, created_at DESC`,
      [userId, date]
    );

    return rows.map(mapAttendanceRow);
  }

  async listBySchool(schoolId: string, page: number, pageSize: number): Promise<AttendanceLogRecordPage> {
    const offset = (page - 1) * pageSize;
    const pool = getDbPool();
    const { rows } = await pool.query<AttendanceLogRow>(
      `SELECT id, school_id, user_id, device_id, direction, verdict, denial_reason, message, scanned_at
       FROM attendance_logs
       WHERE school_id = $1
       ORDER BY scanned_at DESC, created_at DESC
       LIMIT $2 OFFSET $3`,
      [schoolId, pageSize, offset]
    );
    const { rows: countRows } = await pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total
       FROM attendance_logs
       WHERE school_id = $1`,
      [schoolId]
    );

    return {
      records: rows.map(mapAttendanceRow),
      total: Number(countRows[0]?.total ?? 0),
      page,
      pageSize
    };
  }

  async listBySchoolForUsers(
    schoolId: string,
    userIds: string[],
    page: number,
    pageSize: number
  ): Promise<AttendanceLogRecordPage> {
    if (userIds.length === 0) {
      return { records: [], total: 0, page, pageSize };
    }

    const offset = (page - 1) * pageSize;
    const placeholders = userIds.map((_, index) => `$${index + 2}`).join(', ');
    const pool = getDbPool();
    const { rows } = await pool.query<AttendanceLogRow>(
      `SELECT id, school_id, user_id, device_id, direction, verdict, denial_reason, message, scanned_at
       FROM attendance_logs
       WHERE school_id = $1 AND user_id IN (${placeholders})
       ORDER BY scanned_at DESC, created_at DESC
       LIMIT $${userIds.length + 2} OFFSET $${userIds.length + 3}`,
      [schoolId, ...userIds, pageSize, offset]
    );
    const { rows: countRows } = await pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total
       FROM attendance_logs
       WHERE school_id = $1 AND user_id IN (${placeholders})`,
      [schoolId, ...userIds]
    );

    return {
      records: rows.map(mapAttendanceRow),
      total: Number(countRows[0]?.total ?? 0),
      page,
      pageSize
    };
  }

  async listAllBySchool(schoolId: string): Promise<AttendanceLogRecord[]> {
    const { rows } = await getDbPool().query<AttendanceLogRow>(
      `SELECT id, school_id, user_id, device_id, direction, verdict, denial_reason, message, scanned_at
       FROM attendance_logs
       WHERE school_id = $1
       ORDER BY scanned_at ASC, created_at ASC, id ASC`,
      [schoolId]
    );
    return rows.map(mapAttendanceRow);
  }

  async restore(log: AttendanceLogRecord): Promise<AttendanceLogRecord> {
    await getDbPool().query(
      `INSERT INTO attendance_logs (
        id, school_id, user_id, device_id, direction, verdict, denial_reason, message, scanned_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        log.id,
        log.schoolId,
        log.userId,
        log.deviceId,
        log.direction,
        log.verdict,
        log.denialReason,
        log.message,
        log.scannedAt
      ]
    );
    return log;
  }

  async deleteByUser(schoolId: string, userId: string): Promise<number> {
    const result = await getDbPool().query(
      'DELETE FROM attendance_logs WHERE school_id = $1 AND user_id = $2',
      [schoolId, userId]
    );
    return result.rowCount ?? 0;
  }

  async deleteBySchool(schoolId: string): Promise<number> {
    const result = await getDbPool().query(
      'DELETE FROM attendance_logs WHERE school_id = $1',
      [schoolId]
    );
    return result.rowCount ?? 0;
  }
}
