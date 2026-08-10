import type { IAttendanceRepository } from '../repositories/interfaces/IAttendanceRepository.js';
import type { IDeviceRepository } from '../repositories/interfaces/IDeviceRepository.js';
import type { IUserRepository } from '../repositories/interfaces/IUserRepository.js';
import type { ITenantRepository } from '../repositories/interfaces/ITenantRepository.js';
import { toLocalDateKey } from '../utils/timezone.js';
import type {
  AttendanceDisplayStudent,
  AttendanceLogRecordPage,
  AttendanceDirection,
  AttendanceLogListItem,
  AttendanceLogRecord,
  AttendanceFilters,
  AttendancePage,
  AttendanceScanResult
} from '../types/Attendance.js';
import type { UserRecord } from '../types/User.js';
import { attendanceEventBus } from './AttendanceEventBus.js';
import type { NotificationService } from './NotificationService.js';

const COOLDOWN_MINUTES = 30;
const MAX_DAILY_SCANS = 2;

const toMinuteDifference = (earlierIso: string, laterIso: string) => {
  return Math.floor((Date.parse(laterIso) - Date.parse(earlierIso)) / (1000 * 60));
};

const DEFAULT_TIMEZONE = 'UTC';

export class AttendanceService {
  constructor(
    private readonly attendanceRepository: IAttendanceRepository,
    private readonly deviceRepository: IDeviceRepository,
    private readonly userRepository: IUserRepository,
    private readonly tenantRepository?: ITenantRepository,
    private readonly notificationService?: NotificationService
  ) {}

  private async resolveTimezone(schoolId: string): Promise<string> {
    const school = await this.tenantRepository?.findSchoolById(schoolId);
    return school?.timezone || DEFAULT_TIMEZONE;
  }

  async scanCard(
    schoolId: string,
    cardUid: string,
    scannedAt = new Date().toISOString(),
    deviceId?: string
  ): Promise<AttendanceScanResult> {
    const device = deviceId
      ? await this.deviceRepository.findById(deviceId)
      : await this.deviceRepository.findDefaultBySchoolId(schoolId);

    if (!device || device.schoolId !== schoolId || !device.isActive) {
      throw new Error('No device is configured for this school.');
    }

    const student = await this.userRepository.findByCardUid(cardUid);

    if (!student || student.role === 'GUARDIAN') {
      return this.denyScan({
        schoolId,
        device,
        denialReason: 'USER_NOT_FOUND',
        message: 'Card not recognized.',
        scannedAt
      });
    }

    if (student.schoolId !== schoolId) {
      return this.denyScan({
        schoolId,
        device,
        denialReason: 'CROSS_SCHOOL_USER',
        message: 'Card not recognized for this school.',
        scannedAt
      });
    }

    const timezone = await this.resolveTimezone(schoolId);
    const todaysLogs = await this.attendanceRepository.findByUserAndDate(
      student.id,
      toLocalDateKey(scannedAt, timezone),
      timezone
    );
    const admittedLogs = todaysLogs.filter((log) => log.verdict === 'ADMITTED');

    if (admittedLogs.length >= MAX_DAILY_SCANS) {
      return this.denyScan({
        schoolId,
        device,
        denialReason: 'DAILY_LIMIT_REACHED',
        message: `${student.firstName} ${student.lastName} has already completed attendance for today.`,
        scannedAt,
        student
      });
    }

    const mostRecentAdmittedLog = admittedLogs[0];

    if (mostRecentAdmittedLog) {
      const elapsedMinutes = toMinuteDifference(mostRecentAdmittedLog.scannedAt, scannedAt);

      if (elapsedMinutes < COOLDOWN_MINUTES) {
        return this.denyScan({
          schoolId,
          device,
          denialReason: 'COOLDOWN_ACTIVE',
          message: `${student.firstName} ${student.lastName} must wait ${COOLDOWN_MINUTES} minutes before scanning again.`,
          scannedAt,
          student
        });
      }
    }

    const direction: AttendanceDirection = admittedLogs.length === 0 ? 'IN' : 'OUT';
    const admittedLog = await this.attendanceRepository.create({
      schoolId,
      userId: student.id,
      deviceId: device.id,
      direction,
      verdict: 'ADMITTED',
      denialReason: null,
      message: `${student.firstName} ${student.lastName} ${direction === 'IN' ? 'entered' : 'exited'} the campus.`,
      scannedAt
    });

    const result: AttendanceScanResult = {
      schoolId,
      deviceId: device.id,
      deviceName: device.name,
      deviceLocation: device.location,
      verdict: 'ADMITTED',
      denialReason: null,
      student: this.toDisplayStudent(student),
      log: admittedLog
    };

    attendanceEventBus.publish(result);
    if (student.role === 'STUDENT') {
      await this.notificationService?.queueStudentAttendance(
        student,
        admittedLog.id,
        direction,
        scannedAt
      );
    }

    return result;
  }

  async listSchoolLogs(
    schoolId: string,
    page: number,
    pageSize: number,
    filters: AttendanceFilters = {}
  ): Promise<AttendancePage> {
    if (this.hasFilters(filters)) {
      return this.listFilteredLogs(schoolId, null, page, pageSize, filters);
    }

    const payload: AttendanceLogRecordPage = await this.attendanceRepository.listBySchool(schoolId, page, pageSize);
    const records = await Promise.all(payload.records.map((record) => this.toListItem(record)));

    return {
      ...payload,
      records
    };
  }

  async listUserLogs(
    schoolId: string,
    userIds: string[],
    page: number,
    pageSize: number,
    filters: AttendanceFilters = {}
  ): Promise<AttendancePage> {
    if (this.hasFilters(filters)) {
      return this.listFilteredLogs(schoolId, userIds, page, pageSize, filters);
    }

    const payload = await this.attendanceRepository.listBySchoolForUsers(
      schoolId,
      userIds,
      page,
      pageSize
    );
    const records = await Promise.all(payload.records.map((record) => this.toListItem(record)));

    return {
      ...payload,
      records
    };
  }

  async exportSchoolLogs(
    schoolId: string,
    filters: AttendanceFilters = {}
  ): Promise<AttendanceLogListItem[]> {
    return this.getFilteredLogs(schoolId, null, filters);
  }

  async exportUserLogs(
    schoolId: string,
    userIds: string[],
    filters: AttendanceFilters = {}
  ): Promise<AttendanceLogListItem[]> {
    return this.getFilteredLogs(schoolId, userIds, filters);
  }

  private hasFilters(filters: AttendanceFilters) {
    return Object.values(filters).some((value) => value !== undefined && value !== '');
  }

  private async listFilteredLogs(
    schoolId: string,
    userIds: string[] | null,
    page: number,
    pageSize: number,
    filters: AttendanceFilters
  ): Promise<AttendancePage> {
    const records = await this.getFilteredLogs(schoolId, userIds, filters);
    const start = (page - 1) * pageSize;

    return {
      records: records.slice(start, start + pageSize),
      total: records.length,
      page,
      pageSize
    };
  }

  private async getFilteredLogs(
    schoolId: string,
    userIds: string[] | null,
    filters: AttendanceFilters
  ): Promise<AttendanceLogListItem[]> {
    const allowedUserIds = userIds ? new Set(userIds) : null;
    const rawRecords = (await this.attendanceRepository.listAllBySchool(schoolId)).filter((record) => {
      if (allowedUserIds && !allowedUserIds.has(record.userId)) return false;
      if (filters.verdict && record.verdict !== filters.verdict) return false;
      if (filters.direction && record.direction !== filters.direction) return false;
      if (filters.from && Date.parse(record.scannedAt) < Date.parse(filters.from)) return false;
      if (filters.to && Date.parse(record.scannedAt) > Date.parse(filters.to)) return false;
      return true;
    });
    const records = await Promise.all(rawRecords.map((record) => this.toListItem(record)));
    const search = filters.search?.trim().toLocaleLowerCase();

    if (!search) return records;

    return records.filter((record) =>
      [
        record.student?.firstName,
        record.student?.lastName,
        record.student?.gradeLevel,
        record.student?.section,
        record.device?.name,
        record.device?.location,
        record.log.message
      ]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase().includes(search))
    );
  }

  private async denyScan({
    schoolId,
    device,
    denialReason,
    message,
    scannedAt,
    student
  }: {
    schoolId: string;
    device: { id: string; name: string; location: string };
    denialReason: NonNullable<AttendanceScanResult['denialReason']>;
    message: string;
    scannedAt: string;
    student?: UserRecord;
  }): Promise<AttendanceScanResult> {
    const deniedLog = await this.createDeniedLog({
      schoolId,
      deviceId: device.id,
      denialReason,
      message,
      scannedAt,
      userId: student?.id
    });

    const result: AttendanceScanResult = {
      schoolId,
      deviceId: device.id,
      deviceName: device.name,
      deviceLocation: device.location,
      verdict: 'DENIED',
      denialReason,
      student: student ? this.toDisplayStudent(student) : null,
      log: deniedLog
    };

    attendanceEventBus.publish(result);

    return result;
  }

  private async createDeniedLog({
    schoolId,
    deviceId,
    denialReason,
    message,
    scannedAt,
    userId = 'unknown-user'
  }: {
    schoolId: string;
    deviceId: string;
    denialReason: AttendanceScanResult['denialReason'];
    message: string;
    scannedAt: string;
    userId?: string;
  }): Promise<AttendanceLogRecord> {
    return this.attendanceRepository.create({
      schoolId,
      userId,
      deviceId,
      direction: 'IN',
      verdict: 'DENIED',
      denialReason,
      message,
      scannedAt
    });
  }

  private async toListItem(log: AttendanceLogRecord): Promise<AttendanceLogListItem> {
    const student = log.userId === 'unknown-user' ? null : await this.userRepository.findById(log.userId);
    const device = await this.deviceRepository.findById(log.deviceId);

    return {
      log,
      student:
        student && ['ADMIN', 'STAFF', 'STUDENT'].includes(student.role)
          ? this.toDisplayStudent(student)
          : null,
      device: device
        ? {
            id: device.id,
            name: device.name,
            location: device.location
          }
        : null
    };
  }

  private toDisplayStudent(student: UserRecord): AttendanceDisplayStudent {
    return {
      id: student.id,
      schoolId: student.schoolId,
      cardUid: student.cardUid ?? '',
      firstName: student.firstName,
      lastName: student.lastName,
      role:
        student.role === 'ADMIN' || student.role === 'STAFF'
          ? student.role
          : 'STUDENT',
      gradeLevel: student.gradeLevel ?? '',
      section: student.section ?? '',
      imageUrl: student.imageUrl
    };
  }
}
