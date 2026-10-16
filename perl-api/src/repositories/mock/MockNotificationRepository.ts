import { randomUUID } from 'node:crypto';
import type { INotificationRepository } from '../interfaces/INotificationRepository.js';
import type { NotificationTransaction } from '../../types/Notification.js';

let transactions: NotificationTransaction[] = [];

// Hard cap on unbounded whole-school reads (listAllBySchool). Mirrors
// NOTIFICATION_UNBOUNDED_READ_CAP in DbNotificationRepository.
const NOTIFICATION_UNBOUNDED_READ_CAP = 5000;

export const resetMockNotificationTransactions = () => {
  transactions = [];
};

export class MockNotificationRepository implements INotificationRepository {
  async create(
    transaction: Omit<NotificationTransaction, 'id'>
  ): Promise<NotificationTransaction> {
    const created = {
      ...transaction,
      id: `notification-${randomUUID()}`
    };
    transactions.push(created);
    return created;
  }

  async update(
    transactionId: string,
    changes: Partial<NotificationTransaction>
  ): Promise<NotificationTransaction | null> {
    const transaction = transactions.find((entry) => entry.id === transactionId);
    if (!transaction) return null;
    Object.assign(transaction, changes);
    return transaction;
  }

  async listAllBySchool(schoolId: string): Promise<NotificationTransaction[]> {
    return transactions
      .filter((transaction) => transaction.schoolId === schoolId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, NOTIFICATION_UNBOUNDED_READ_CAP);
  }

  async deleteBySchool(schoolId: string): Promise<number> {
    const before = transactions.length;
    transactions = transactions.filter((transaction) => transaction.schoolId !== schoolId);
    return before - transactions.length;
  }

  async deleteByUser(schoolId: string, userId: string): Promise<number> {
    const before = transactions.length;
    transactions = transactions.filter(
      (transaction) =>
        transaction.schoolId !== schoolId ||
        (transaction.studentUserId !== userId && transaction.guardianUserId !== userId)
    );
    return before - transactions.length;
  }
}
