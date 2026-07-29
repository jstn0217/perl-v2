import type { AttendanceLogRecord, AttendanceLogRecordPage } from '../../types/Attendance.js';
import type { IAttendanceRepository } from '../interfaces/IAttendanceRepository.js';

let attendanceLogs: AttendanceLogRecord[] = [];

export const resetMockAttendanceLogs = () => {
  attendanceLogs = [];
};

export class MockAttendanceRepository implements IAttendanceRepository {
  async create(log: Omit<AttendanceLogRecord, 'id'>): Promise<AttendanceLogRecord> {
    const record: AttendanceLogRecord = {
      ...log,
      id: `attendance-${attendanceLogs.length + 1}`
    };

    attendanceLogs.unshift(record);

    return record;
  }

  async findByUserAndDate(userId: string, date: string): Promise<AttendanceLogRecord[]> {
    return attendanceLogs.filter((log) => log.userId === userId && log.scannedAt.startsWith(date));
  }

  async listBySchool(schoolId: string, page: number, pageSize: number): Promise<AttendanceLogRecordPage> {
    const schoolLogs = attendanceLogs.filter((log) => log.schoolId === schoolId);
    const start = (page - 1) * pageSize;
    const records = schoolLogs.slice(start, start + pageSize);

    return {
      records,
      total: schoolLogs.length,
      page,
      pageSize
    };
  }

  async listBySchoolForUsers(
    schoolId: string,
    userIds: string[],
    page: number,
    pageSize: number
  ): Promise<AttendanceLogRecordPage> {
    const allowedUserIds = new Set(userIds);
    const scopedLogs = attendanceLogs.filter(
      (log) => log.schoolId === schoolId && allowedUserIds.has(log.userId)
    );
    const start = (page - 1) * pageSize;

    return {
      records: scopedLogs.slice(start, start + pageSize),
      total: scopedLogs.length,
      page,
      pageSize
    };
  }

  async listAllBySchool(schoolId: string): Promise<AttendanceLogRecord[]> {
    return attendanceLogs.filter((log) => log.schoolId === schoolId);
  }

  async restore(log: AttendanceLogRecord): Promise<AttendanceLogRecord> {
    attendanceLogs.push(log);
    return log;
  }

  async deleteByUser(schoolId: string, userId: string): Promise<number> {
    const before = attendanceLogs.length;
    attendanceLogs = attendanceLogs.filter(
      (log) => log.schoolId !== schoolId || log.userId !== userId
    );
    return before - attendanceLogs.length;
  }

  async deleteBySchool(schoolId: string): Promise<number> {
    const before = attendanceLogs.length;
    attendanceLogs = attendanceLogs.filter((log) => log.schoolId !== schoolId);
    return before - attendanceLogs.length;
  }
}
