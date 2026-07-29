import type { AttendanceScanResult } from '../types/attendance';

export const formatAttendanceTimestamp = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));

export const attendanceVerdictLabel: Record<AttendanceScanResult['verdict'], string> = {
  ADMITTED: 'Admitted',
  DENIED: 'Denied'
};

export const attendanceDenialLabel: Record<
  NonNullable<AttendanceScanResult['denialReason']>,
  string
> = {
  USER_NOT_FOUND: 'Unknown card',
  CROSS_SCHOOL_USER: 'Wrong school',
  COOLDOWN_ACTIVE: 'Cooldown',
  DAILY_LIMIT_REACHED: 'Daily limit'
};
