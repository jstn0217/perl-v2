import type { AttendanceDirection } from './Attendance.js';

export type NotificationStatus = 'QUEUED' | 'SENT' | 'FAILED' | 'SKIPPED';

export interface NotificationTransaction {
  id: string;
  schoolId: string;
  attendanceLogId: string;
  studentUserId: string;
  guardianUserId: string | null;
  recipient: string | null;
  direction: AttendanceDirection;
  message: string;
  provider: 'SEMAPHORE' | 'MOCK';
  status: NotificationStatus;
  providerMessageId: string | null;
  providerStatus: string | null;
  network: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface NotificationFilters {
  search?: string;
  status?: NotificationStatus;
  direction?: AttendanceDirection;
  from?: string;
  to?: string;
}

export interface NotificationPage {
  records: NotificationTransaction[];
  total: number;
  page: number;
  pageSize: number;
}
