import { randomUUID } from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        log.schoolId,
        log.userId,
        log.deviceId,
        log.direction,
        log.verdict,
        log.denialReason,
        log.message,
        log.scannedAt.replace('T', ' ').replace('Z', '')
      ]
    );

    return {
      ...log,
      id
    };
  }

  async findByUserAndDate(userId: string, date: string): Promise<AttendanceLogRecord[]> {
    const [rows] = await getDbPool().query<(AttendanceLogRow & RowDataPacket)[]>(
      `SELECT id, school_id, user_id, device_id, direction, verdict, denial_reason, message, scanned_at
       FROM attendance_logs
       WHERE user_id = ? AND DATE(scanned_at) = ?
       ORDER BY scanned_at DESC, created_at DESC`,
      [userId, date]
    );

    return rows.map(mapAttendanceRow);
  }

  async listBySchool(schoolId: string, page: number, pageSize: number): Promise<AttendanceLogRecordPage> {
    const offset = (page - 1) * pageSize;
    const pool = getDbPool();
    const [rows] = await pool.query<(AttendanceLogRow & RowDataPacket)[]>(
      `SELECT id, school_id, user_id, device_id, direction, verdict, denial_reason, message, scanned_at
       FROM attendance_logs
       WHERE school_id = ?
       ORDER BY scanned_at DESC, created_at DESC
       LIMIT ? OFFSET ?`,
      [schoolId, pageSize, offset]
    );
    const [countRows] = await pool.query<(RowDataPacket & { total: number })[]>(
      `SELECT COUNT(*) AS total
       FROM attendance_logs
       WHERE school_id = ?`,
      [schoolId]
    );

    return {
      records: rows.map(mapAttendanceRow),
      total: countRows[0]?.total ?? 0,
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
    const placeholders = userIds.map(() => '?').join(', ');
    const pool = getDbPool();
    const [rows] = await pool.query<(AttendanceLogRow & RowDataPacket)[]>(
      `SELECT id, school_id, user_id, device_id, direction, verdict, denial_reason, message, scanned_at
       FROM attendance_logs
       WHERE school_id = ? AND user_id IN (${placeholders})
       ORDER BY scanned_at DESC, created_at DESC
       LIMIT ? OFFSET ?`,
      [schoolId, ...userIds, pageSize, offset]
    );
    const [countRows] = await pool.query<(RowDataPacket & { total: number })[]>(
      `SELECT COUNT(*) AS total
       FROM attendance_logs
       WHERE school_id = ? AND user_id IN (${placeholders})`,
      [schoolId, ...userIds]
    );

    return {
      records: rows.map(mapAttendanceRow),
      total: countRows[0]?.total ?? 0,
      page,
      pageSize
    };
  }

  async listAllBySchool(schoolId: string): Promise<AttendanceLogRecord[]> {
    const [rows] = await getDbPool().query<(AttendanceLogRow & RowDataPacket)[]>(
      `SELECT id, school_id, user_id, device_id, direction, verdict, denial_reason, message, scanned_at
       FROM attendance_logs
       WHERE school_id = ?
       ORDER BY scanned_at ASC, created_at ASC, id ASC`,
      [schoolId]
    );
    return rows.map(mapAttendanceRow);
  }

  async restore(log: AttendanceLogRecord): Promise<AttendanceLogRecord> {
    await getDbPool().query(
      `INSERT INTO attendance_logs (
        id, school_id, user_id, device_id, direction, verdict, denial_reason, message, scanned_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        log.id,
        log.schoolId,
        log.userId,
        log.deviceId,
        log.direction,
        log.verdict,
        log.denialReason,
        log.message,
        log.scannedAt.replace('T', ' ').replace('Z', '')
      ]
    );
    return log;
  }

  async deleteByUser(schoolId: string, userId: string): Promise<number> {
    const [result] = await getDbPool().query<ResultSetHeader>(
      'DELETE FROM attendance_logs WHERE school_id = ? AND user_id = ?',
      [schoolId, userId]
    );
    return result.affectedRows ?? 0;
  }

  async deleteBySchool(schoolId: string): Promise<number> {
    const [result] = await getDbPool().query<ResultSetHeader>(
      'DELETE FROM attendance_logs WHERE school_id = ?',
      [schoolId]
    );
    return result.affectedRows ?? 0;
  }
}
