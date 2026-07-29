import type { NotificationTransaction } from '../../types/Notification.js';

export interface INotificationRepository {
  create(
    transaction: Omit<NotificationTransaction, 'id'>
  ): Promise<NotificationTransaction>;
  update(
    transactionId: string,
    changes: Partial<NotificationTransaction>
  ): Promise<NotificationTransaction | null>;
  listAllBySchool(schoolId: string): Promise<NotificationTransaction[]>;
  deleteBySchool(schoolId: string): Promise<number>;
  deleteByUser(schoolId: string, userId: string): Promise<number>;
}
