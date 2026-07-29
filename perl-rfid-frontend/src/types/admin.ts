import type { SchoolTheme } from './school';

export type SchoolUserRole = 'ADMIN' | 'STAFF' | 'STUDENT' | 'GUARDIAN';
export type PlatformUserRole = 'SYSTEM_ADMIN' | 'SUPPORT';
export type UserRole = SchoolUserRole | PlatformUserRole;

export interface ManagedUser {
  id: string;
  schoolId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: SchoolUserRole;
  cardUid: string | null;
  gradeLevel: string | null;
  section: string | null;
  imageUrl: string | null;
  phoneNumber: string | null;
  linkedStudentIds: string[];
  isActive: boolean;
}

export interface SchoolProfileUpdatePayload {
  name: string;
  logoUrl: string | null;
  contactEmail: string;
  theme: SchoolTheme;
}

export interface ManagedUserCreatePayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: SchoolUserRole;
  cardUid?: string | null;
  gradeLevel?: string | null;
  section?: string | null;
  imageUrl?: string | null;
  phoneNumber?: string | null;
  linkedStudentIds?: string[];
}

export interface ManagedUserUpdatePayload {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: SchoolUserRole;
  cardUid?: string | null;
  gradeLevel?: string | null;
  section?: string | null;
  imageUrl?: string | null;
  phoneNumber?: string | null;
  linkedStudentIds?: string[];
}

export interface ManagedUserImportPayload extends Omit<ManagedUserCreatePayload, 'linkedStudentIds'> {
  linkedStudentEmails?: string[];
}

export interface ManagedUserImportResult {
  created: ManagedUser[];
  errors: Array<{ row: number; message: string }>;
}

export interface ManagedDevice {
  id: string;
  schoolId: string;
  name: string;
  location: string;
  keyLastFour: string;
  isActive: boolean;
}

export interface ManagedDeviceCreatePayload {
  name: string;
  location: string;
}

export interface RegisteredDeviceResponse {
  device: ManagedDevice;
  deviceKey: string;
}

export interface AuditRecord {
  id: string;
  schoolId: string;
  actorUserId: string;
  actorRole: UserRole;
  supportInitiated: boolean;
  action: string;
  targetType: 'SCHOOL' | 'USER' | 'DEVICE';
  targetId: string | null;
  changeSummary: string;
  occurredAt: string;
}

export interface AuditPage {
  records: AuditRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditFilters {
  search: string;
  action: string;
  actorRole: '' | UserRole;
  supportInitiated: '' | 'true' | 'false';
  targetType: '' | AuditRecord['targetType'];
  from: string;
  to: string;
}

export type NotificationStatus = 'QUEUED' | 'SENT' | 'FAILED' | 'SKIPPED';

export interface NotificationTransaction {
  id: string;
  schoolId: string;
  attendanceLogId: string;
  studentUserId: string;
  guardianUserId: string | null;
  recipient: string | null;
  direction: 'IN' | 'OUT';
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
  search: string;
  status: '' | NotificationStatus;
  direction: '' | 'IN' | 'OUT';
  from: string;
  to: string;
}

export interface NotificationPage {
  records: NotificationTransaction[];
  total: number;
  page: number;
  pageSize: number;
}
