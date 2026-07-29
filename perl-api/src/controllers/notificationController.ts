import type { Request, Response } from 'express';
import type { RepositorySet } from '../repositories/index.js';
import { NotificationService } from '../services/NotificationService.js';
import type { NotificationFilters, NotificationTransaction } from '../types/Notification.js';
import {
  readSelectedCsvColumns,
  sendCsvColumnDownload,
  type CsvColumn
} from '../utils/csv.js';

const columns: CsvColumn<NotificationTransaction>[] = [
  { key: 'createdAt', label: 'Created at', value: (row) => row.createdAt },
  { key: 'status', label: 'Status', value: (row) => row.status },
  { key: 'direction', label: 'Direction', value: (row) => row.direction },
  { key: 'recipient', label: 'Recipient', value: (row) => row.recipient },
  { key: 'message', label: 'Message', value: (row) => row.message },
  { key: 'provider', label: 'Provider', value: (row) => row.provider },
  { key: 'providerStatus', label: 'Provider status', value: (row) => row.providerStatus },
  { key: 'providerMessageId', label: 'Provider message ID', value: (row) => row.providerMessageId },
  { key: 'network', label: 'Network', value: (row) => row.network },
  { key: 'errorMessage', label: 'Error', value: (row) => row.errorMessage },
  { key: 'attendanceLogId', label: 'Attendance log ID', value: (row) => row.attendanceLogId },
  { key: 'studentUserId', label: 'Student user ID', value: (row) => row.studentUserId },
  { key: 'guardianUserId', label: 'Guardian user ID', value: (row) => row.guardianUserId }
];

const text = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const readFilters = (query: Request['query']): NotificationFilters => {
  const status = text(query.status);
  const direction = text(query.direction);
  const from = text(query.from);
  const to = text(query.to);
  if (status && !['QUEUED', 'SENT', 'FAILED', 'SKIPPED'].includes(status)) {
    throw new Error('Invalid SMS status filter.');
  }
  if (direction && !['IN', 'OUT'].includes(direction)) {
    throw new Error('Invalid SMS direction filter.');
  }
  if (from && Number.isNaN(Date.parse(from))) throw new Error('Invalid start date.');
  if (to && Number.isNaN(Date.parse(to))) throw new Error('Invalid end date.');
  return {
    search: text(query.search),
    status: status as NotificationFilters['status'],
    direction: direction as NotificationFilters['direction'],
    from,
    to
  };
};

const positiveInt = (value: unknown, fallback: number, max: number) => {
  const parsed = Number.parseInt(typeof value === 'string' ? value : '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
};

export const createNotificationController = (repositories: RepositorySet) => {
  const service = new NotificationService(
    repositories.notificationRepository,
    repositories.userRepository,
    repositories.tenantRepository,
    { enabled: false, provider: 'SEMAPHORE', send: async () => { throw new Error('Unavailable.'); } }
  );

  return {
    async list(req: Request, res: Response) {
      try {
        const schoolId = typeof req.params.schoolId === 'string' ? req.params.schoolId : '';
        const page = positiveInt(req.query.page, 1, Number.MAX_SAFE_INTEGER);
        const pageSize = positiveInt(req.query.pageSize, 20, 100);
        return res.json(await service.list(schoolId, page, pageSize, readFilters(req.query)));
      } catch (error) {
        return res.status(400).json({
          message: error instanceof Error ? error.message : 'Unable to load SMS delivery logs.'
        });
      }
    },

    async export(req: Request, res: Response) {
      try {
        const schoolId = typeof req.params.schoolId === 'string' ? req.params.schoolId : '';
        const records = await service.export(schoolId, readFilters(req.query));
        const selected = readSelectedCsvColumns(req.query.columns, columns);
        return sendCsvColumnDownload(
          res,
          `sms-delivery-${new Date().toISOString().slice(0, 10)}.csv`,
          selected,
          records
        );
      } catch (error) {
        return res.status(400).json({
          message: error instanceof Error ? error.message : 'Unable to export SMS delivery logs.'
        });
      }
    }
  };
};
