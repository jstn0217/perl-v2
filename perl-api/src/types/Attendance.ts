export type AttendanceDirection = 'IN' | 'OUT';
export type AttendanceVerdict = 'ADMITTED' | 'DENIED';
export type AttendanceDenialReason =
  | 'USER_NOT_FOUND'
  | 'CROSS_SCHOOL_USER'
  | 'COOLDOWN_ACTIVE'
  | 'DAILY_LIMIT_REACHED';

export interface AttendanceLogRecord {
  id: string;
  schoolId: string;
  userId: string;
  deviceId: string;
  direction: AttendanceDirection;
  verdict: AttendanceVerdict;
  denialReason: AttendanceDenialReason | null;
  message: string;
  scannedAt: string;
}

export interface AttendanceDisplayStudent {
  id: string;
  schoolId: string;
  cardUid: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'STAFF' | 'STUDENT';
  gradeLevel: string;
  section: string;
  imageUrl: string | null;
}

export interface AttendanceScanResult {
  schoolId: string;
  deviceId: string;
  deviceName: string;
  deviceLocation: string;
  verdict: AttendanceVerdict;
  denialReason: AttendanceDenialReason | null;
  student: AttendanceDisplayStudent | null;
  log: AttendanceLogRecord;
}

export interface AttendanceLogListItem {
  log: AttendanceLogRecord;
  student: AttendanceDisplayStudent | null;
  device: {
    id: string;
    name: string;
    location: string;
  } | null;
}

export interface AttendanceLogRecordPage {
  records: AttendanceLogRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AttendancePage {
  records: AttendanceLogListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AttendanceFilters {
  search?: string;
  verdict?: AttendanceVerdict;
  direction?: AttendanceDirection;
  from?: string;
  to?: string;
}
