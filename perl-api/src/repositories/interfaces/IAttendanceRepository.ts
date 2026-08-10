import type { AttendanceLogRecord, AttendanceLogRecordPage } from '../../types/Attendance.js';

export interface IAttendanceRepository {
  create(log: Omit<AttendanceLogRecord, 'id'>): Promise<AttendanceLogRecord>;
  findByUserAndDate(userId: string, date: string, timezone: string): Promise<AttendanceLogRecord[]>;
  listBySchool(schoolId: string, page: number, pageSize: number): Promise<AttendanceLogRecordPage>;
  listBySchoolForUsers(
    schoolId: string,
    userIds: string[],
    page: number,
    pageSize: number
  ): Promise<AttendanceLogRecordPage>;
  listAllBySchool(schoolId: string): Promise<AttendanceLogRecord[]>;
  restore(log: AttendanceLogRecord): Promise<AttendanceLogRecord>;
  deleteByUser(schoolId: string, userId: string): Promise<number>;
  deleteBySchool(schoolId: string): Promise<number>;
}
