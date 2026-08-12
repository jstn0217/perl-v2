import type { AttendanceLogRecord, AttendanceLogRecordPage } from '../../types/Attendance.js';
import type { IAttendanceRepository } from '../interfaces/IAttendanceRepository.js';
import { toLocalDateKey } from '../../utils/timezone.js';

let attendanceLogs: AttendanceLogRecord[] = [];

// Hard cap on unbounded whole-school reads (filtered listing/export). Mirrors
// the cap in DbAttendanceRepository. Prevents a single request from loading
// a school's entire attendance history into memory.
const ATTENDANCE_UNBOUNDED_READ_CAP = 5000;

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

  async findByUserAndDate(userId: string, date: string, timezone: string): Promise<AttendanceLogRecord[]> {
    return attendanceLogs.filter(
      (log) => log.userId === userId && toLocalDateKey(log.scannedAt, timezone) === date
    );
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
    // Records are unshifted on create, so the array is already newest-first;
    // slicing from the front caps at the most recent entries.
    return attendanceLogs
      .filter((log) => log.schoolId === schoolId)
      .slice(0, ATTENDANCE_UNBOUNDED_READ_CAP);
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
