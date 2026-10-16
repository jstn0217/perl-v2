import type { AttendanceLogRecord } from './Attendance.js';
import type { AuditRecord } from './Audit.js';
import type { DeviceRecord } from './Device.js';
import type { SchoolProfile } from './SchoolProfile.js';
import type { SubmissionRecord } from './Submission.js';
import type { UserRecord } from './User.js';

export interface SchoolDataSnapshot {
  format: 'perl-school-backup';
  version: 2;
  exportedAt: string;
  school: SchoolProfile;
  users: UserRecord[];
  devices: DeviceRecord[];
  attendanceLogs: AttendanceLogRecord[];
  submissions: SubmissionRecord[];
}

export interface SchoolDataExport {
  format: 'perl-school-export';
  version: 2;
  exportedAt: string;
  school: SchoolProfile;
  users: Array<Omit<UserRecord, 'passwordHash'>>;
  devices: Array<Omit<DeviceRecord, 'keyHash'>>;
  attendanceLogs: AttendanceLogRecord[];
  auditRecords: AuditRecord[];
  submissions: SubmissionRecord[];
}

export interface UserDataExport {
  format: 'perl-user-export';
  version: 1;
  exportedAt: string;
  school: Pick<SchoolProfile, 'id' | 'slug' | 'name'>;
  user: Omit<UserRecord, 'passwordHash'>;
  attendanceLogs: AttendanceLogRecord[];
  auditRecords: AuditRecord[];
}
