import { randomUUID } from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { INotificationRepository } from '../interfaces/INotificationRepository.js';
import type { NotificationTransaction } from '../../types/Notification.js';
import { getDbPool } from './pool.js';

interface NotificationRow extends RowDataPacket {
  id: string;
  school_id: string;
  attendance_log_id: string;
  student_user_id: string;
  guardian_user_id: string | null;
  recipient: string | null;
  direction: NotificationTransaction['direction'];
  message: string;
  provider: NotificationTransaction['provider'];
  status: NotificationTransaction['status'];
  provider_message_id: string | null;
  provider_status: string | null;
  network: string | null;
  error_message: string | null;
  created_at: Date | string;
  completed_at: Date | string | null;
}

const toIsoString = (value: Date | string | null) => {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`).toISOString();
};

const mapNotification = (row: NotificationRow): NotificationTransaction => ({
  id: row.id,
  schoolId: row.school_id,
  attendanceLogId: row.attendance_log_id,
  studentUserId: row.student_user_id,
  guardianUserId: row.guardian_user_id,
  recipient: row.recipient,
  direction: row.direction,
  message: row.message,
  provider: row.provider,
  status: row.status,
  providerMessageId: row.provider_message_id,
  providerStatus: row.provider_status,
  network: row.network,
  errorMessage: row.error_message,
  createdAt: toIsoString(row.created_at) ?? new Date(0).toISOString(),
  completedAt: toIsoString(row.completed_at)
});

const selectColumns = `
  id, school_id, attendance_log_id, student_user_id, guardian_user_id, recipient,
  direction, message, provider, status, provider_message_id, provider_status,
  network, error_message, created_at, completed_at
`;

export class DbNotificationRepository implements INotificationRepository {
  async create(
    transaction: Omit<NotificationTransaction, 'id'>
  ): Promise<NotificationTransaction> {
    const id = `notification-${randomUUID()}`;
    await getDbPool().query(
      `INSERT INTO notification_transactions (
        id, school_id, attendance_log_id, student_user_id, guardian_user_id, recipient,
        direction, message, provider, status, provider_message_id, provider_status,
        network, error_message, created_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        transaction.schoolId,
        transaction.attendanceLogId,
        transaction.studentUserId,
        transaction.guardianUserId,
        transaction.recipient,
        transaction.direction,
        transaction.message,
        transaction.provider,
        transaction.status,
        transaction.providerMessageId,
        transaction.providerStatus,
        transaction.network,
        transaction.errorMessage,
        transaction.createdAt.replace('T', ' ').replace('Z', ''),
        transaction.completedAt?.replace('T', ' ').replace('Z', '') ?? null
      ]
    );
    return { ...transaction, id };
  }

  async update(
    transactionId: string,
    changes: Partial<NotificationTransaction>
  ): Promise<NotificationTransaction | null> {
    const existing = await this.findById(transactionId);
    if (!existing) return null;
    const next = { ...existing, ...changes };
    await getDbPool().query(
      `UPDATE notification_transactions
       SET status = ?, provider_message_id = ?, provider_status = ?, network = ?,
           error_message = ?, completed_at = ?
       WHERE id = ?`,
      [
        next.status,
        next.providerMessageId,
        next.providerStatus,
        next.network,
        next.errorMessage,
        next.completedAt?.replace('T', ' ').replace('Z', '') ?? null,
        transactionId
      ]
    );
    return next;
  }

  async listAllBySchool(schoolId: string): Promise<NotificationTransaction[]> {
    const [rows] = await getDbPool().query<NotificationRow[]>(
      `SELECT ${selectColumns}
       FROM notification_transactions
       WHERE school_id = ?
       ORDER BY created_at DESC, id DESC`,
      [schoolId]
    );
    return rows.map(mapNotification);
  }

  async deleteBySchool(schoolId: string): Promise<number> {
    const [result] = await getDbPool().query<ResultSetHeader>(
      'DELETE FROM notification_transactions WHERE school_id = ?',
      [schoolId]
    );
    return result.affectedRows ?? 0;
  }

  async deleteByUser(schoolId: string, userId: string): Promise<number> {
    const [result] = await getDbPool().query<ResultSetHeader>(
      `DELETE FROM notification_transactions
       WHERE school_id = ? AND (student_user_id = ? OR guardian_user_id = ?)`,
      [schoolId, userId, userId]
    );
    return result.affectedRows ?? 0;
  }

  private async findById(transactionId: string): Promise<NotificationTransaction | null> {
    const [rows] = await getDbPool().query<NotificationRow[]>(
      `SELECT ${selectColumns}
       FROM notification_transactions
       WHERE id = ?
       LIMIT 1`,
      [transactionId]
    );
    return rows[0] ? mapNotification(rows[0]) : null;
  }
}
