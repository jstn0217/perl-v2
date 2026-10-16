import { randomUUID } from 'node:crypto';
import type { INotificationRepository } from '../interfaces/INotificationRepository.js';
import type { NotificationTransaction } from '../../types/Notification.js';
import { getDbPool } from './pool.js';

// Hard cap on unbounded whole-school reads (listAllBySchool, used by filtered
// listing/export). Mirrors ATTENDANCE_UNBOUNDED_READ_CAP in
// DbAttendanceRepository. Prevents a single request from loading a school's
// entire notification history into memory.
const NOTIFICATION_UNBOUNDED_READ_CAP = 5000;

interface NotificationRow {
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
  created_at: Date;
  completed_at: Date | null;
}

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
  createdAt: row.created_at.toISOString(),
  completedAt: row.completed_at ? row.completed_at.toISOString() : null
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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
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
        transaction.createdAt,
        transaction.completedAt ?? null
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
       SET status = $1, provider_message_id = $2, provider_status = $3, network = $4,
           error_message = $5, completed_at = $6
       WHERE id = $7`,
      [
        next.status,
        next.providerMessageId,
        next.providerStatus,
        next.network,
        next.errorMessage,
        next.completedAt ?? null,
        transactionId
      ]
    );
    return next;
  }

  async listAllBySchool(schoolId: string): Promise<NotificationTransaction[]> {
    const { rows } = await getDbPool().query<NotificationRow>(
      `SELECT ${selectColumns}
       FROM notification_transactions
       WHERE school_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT $2`,
      [schoolId, NOTIFICATION_UNBOUNDED_READ_CAP]
    );
    return rows.map(mapNotification);
  }

  async deleteBySchool(schoolId: string): Promise<number> {
    const result = await getDbPool().query(
      'DELETE FROM notification_transactions WHERE school_id = $1',
      [schoolId]
    );
    return result.rowCount ?? 0;
  }

  async deleteByUser(schoolId: string, userId: string): Promise<number> {
    const result = await getDbPool().query(
      `DELETE FROM notification_transactions
       WHERE school_id = $1 AND (student_user_id = $2 OR guardian_user_id = $2)`,
      [schoolId, userId]
    );
    return result.rowCount ?? 0;
  }

  private async findById(transactionId: string): Promise<NotificationTransaction | null> {
    const { rows } = await getDbPool().query<NotificationRow>(
      `SELECT ${selectColumns}
       FROM notification_transactions
       WHERE id = $1
       LIMIT 1`,
      [transactionId]
    );
    return rows[0] ? mapNotification(rows[0]) : null;
  }
}
