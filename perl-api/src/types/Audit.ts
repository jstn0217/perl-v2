import type { UserRole } from './User.js';

export const auditActions = [
  'SUPPORT_CONTEXT_ACCESSED',
  'SCHOOL_CREATED',
  'SCHOOL_SMS_SETTINGS_UPDATED',
  'SCHOOL_FEATURE_TOGGLED',
  'SCHOOL_PROFILE_UPDATED',
  'SCHOOL_LOGO_UPDATED',
  'USER_CREATED',
  'USERS_IMPORTED',
  'USER_UPDATED',
  'USER_IMAGE_UPDATED',
  'USER_DEACTIVATED',
  'USER_REACTIVATED',
  'DEVICE_REGISTERED',
  'DEVICE_KEY_ROTATED',
  'DEVICE_DEACTIVATED',
  'ATTENDANCE_EXPORTED',
  'SCHOOL_DATA_EXPORTED',
  'SCHOOL_BACKUP_CREATED',
  'USER_DATA_EXPORTED',
  'USER_DATA_ERASED',
  'SCHOOL_DATA_ERASED',
  'SCHOOL_BACKUP_RESTORED',
  'SUPPORT_SCAN_SIMULATED',
  'ATTENDANCE_LOGS_VIEWED',
  'ATTENDANCE_STREAM_OPENED',
  'SCHOOL_DATA_VIEWED',
  'ROLE_CREATED',
  'ROLE_UPDATED',
  'ROLE_DEACTIVATED',
  'ROLE_REACTIVATED',
  'SUBMISSION_CREATED',
  'SUBMISSION_UPDATED'
] as const;

export type AuditAction = (typeof auditActions)[number];

export interface AuditRecord {
  id: string;
  // Null for platform-wide actions that aren't scoped to any single school —
  // currently only role-catalog mutations (ROLE_CREATED etc.), since
  // RoleDefinition has no schoolId (custom roles are shared across schools).
  schoolId: string | null;
  actorUserId: string;
  actorRole: UserRole;
  supportInitiated: boolean;
  action: AuditAction;
  targetType: 'SCHOOL' | 'USER' | 'DEVICE' | 'ROLE' | 'SUBMISSION';
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
  search?: string;
  action?: AuditAction;
  actorRole?: UserRole;
  supportInitiated?: boolean;
  targetType?: AuditRecord['targetType'];
  from?: string;
  to?: string;
}
