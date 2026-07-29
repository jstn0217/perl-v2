import type { IAttendanceRepository } from '../repositories/interfaces/IAttendanceRepository.js';
import type { IAuditRepository } from '../repositories/interfaces/IAuditRepository.js';
import type { IDeviceRepository } from '../repositories/interfaces/IDeviceRepository.js';
import type { ITenantRepository } from '../repositories/interfaces/ITenantRepository.js';
import type { IUserRepository } from '../repositories/interfaces/IUserRepository.js';
import type { SchoolDataExport, SchoolDataSnapshot, UserDataExport } from '../types/SchoolData.js';
import type { AttendanceLogRecord } from '../types/Attendance.js';
import type { DeviceRecord } from '../types/Device.js';
import type { SchoolProfile } from '../types/SchoolProfile.js';
import type { UserRecord } from '../types/User.js';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const isString = (value: unknown): value is string => typeof value === 'string';
const isNullableString = (value: unknown): value is string | null => value === null || isString(value);
const hexColorPattern = /^#[0-9a-fA-F]{6}$/;
const hashPattern = /^[0-9a-f]{64}$/;
const maxBackupRecords = 100_000;

const isSchoolProfile = (value: unknown, schoolId: string): value is SchoolProfile => {
  if (!isObject(value) || !isObject(value.theme)) return false;

  return (
    value.id === schoolId &&
    isString(value.slug) &&
    isString(value.name) &&
    isNullableString(value.logoUrl) &&
    isString(value.contactEmail) &&
    isString(value.theme.primaryColor) &&
    hexColorPattern.test(value.theme.primaryColor) &&
    isString(value.theme.secondaryColor) &&
    hexColorPattern.test(value.theme.secondaryColor) &&
    isString(value.theme.accentColor) &&
    hexColorPattern.test(value.theme.accentColor)
  );
};

const isUserRecord = (value: unknown, schoolId: string): value is UserRecord => {
  if (!isObject(value)) return false;

  return (
    isString(value.id) &&
    value.schoolId === schoolId &&
    isString(value.email) &&
    isString(value.passwordHash) &&
    value.passwordHash.startsWith('$2') &&
    isString(value.firstName) &&
    isString(value.lastName) &&
    ['ADMIN', 'STAFF', 'STUDENT', 'GUARDIAN'].includes(String(value.role)) &&
    isNullableString(value.cardUid) &&
    isNullableString(value.gradeLevel) &&
    isNullableString(value.section) &&
    isNullableString(value.imageUrl) &&
    (value.linkedStudentIds === undefined ||
      (Array.isArray(value.linkedStudentIds) && value.linkedStudentIds.every(isString))) &&
    typeof value.isActive === 'boolean'
  );
};

const isDeviceRecord = (value: unknown, schoolId: string): value is DeviceRecord => {
  if (!isObject(value)) return false;

  return (
    isString(value.id) &&
    value.schoolId === schoolId &&
    isString(value.name) &&
    isString(value.location) &&
    isString(value.keyHash) &&
    hashPattern.test(value.keyHash) &&
    isString(value.keyLastFour) &&
    value.keyLastFour.length === 4 &&
    typeof value.isActive === 'boolean'
  );
};

const isAttendanceRecord = (value: unknown, schoolId: string): value is AttendanceLogRecord => {
  if (!isObject(value)) return false;

  return (
    isString(value.id) &&
    value.schoolId === schoolId &&
    isString(value.userId) &&
    isString(value.deviceId) &&
    ['IN', 'OUT'].includes(String(value.direction)) &&
    ['ADMITTED', 'DENIED'].includes(String(value.verdict)) &&
    (value.denialReason === null ||
      ['USER_NOT_FOUND', 'CROSS_SCHOOL_USER', 'COOLDOWN_ACTIVE', 'DAILY_LIMIT_REACHED'].includes(
        String(value.denialReason)
      )) &&
    isString(value.message) &&
    isString(value.scannedAt) &&
    Number.isFinite(Date.parse(value.scannedAt))
  );
};

const hasDuplicates = (values: string[]) => new Set(values).size !== values.length;

const toPortableUser = (user: UserRecord) => {
  const portable = { ...user } as Partial<UserRecord>;
  delete portable.passwordHash;
  return portable as Omit<UserRecord, 'passwordHash'>;
};
const toPortableDevice = (device: import('../types/Device.js').DeviceRecord) => {
  const portable = { ...device } as Partial<import('../types/Device.js').DeviceRecord>;
  delete portable.keyHash;
  return portable as Omit<import('../types/Device.js').DeviceRecord, 'keyHash'>;
};

export class SchoolDataService {
  constructor(
    private readonly tenantRepository: ITenantRepository,
    private readonly userRepository: IUserRepository,
    private readonly deviceRepository: IDeviceRepository,
    private readonly attendanceRepository: IAttendanceRepository,
    private readonly auditRepository: IAuditRepository
  ) {}

  async exportSchool(schoolId: string): Promise<SchoolDataExport> {
    const [snapshot, auditPage] = await Promise.all([
      this.createSnapshot(schoolId),
      this.auditRepository.listBySchool(schoolId, 1, maxBackupRecords)
    ]);

    return {
      format: 'perl-school-export',
      version: 1,
      exportedAt: snapshot.exportedAt,
      school: snapshot.school,
      users: snapshot.users.map(toPortableUser),
      devices: snapshot.devices.map(toPortableDevice),
      attendanceLogs: snapshot.attendanceLogs,
      auditRecords: auditPage.records
    };
  }

  async backupSchool(schoolId: string): Promise<SchoolDataSnapshot> {
    return this.createSnapshot(schoolId);
  }

  async exportUser(schoolId: string, userId: string): Promise<UserDataExport> {
    const [school, user, attendanceLogs, auditPage] = await Promise.all([
      this.requireSchool(schoolId),
      this.requireSchoolUser(schoolId, userId),
      this.attendanceRepository.listAllBySchool(schoolId),
      this.auditRepository.listBySchool(schoolId, 1, maxBackupRecords)
    ]);

    return {
      format: 'perl-user-export',
      version: 1,
      exportedAt: new Date().toISOString(),
      school: { id: school.id, slug: school.slug, name: school.name },
      user: toPortableUser(user),
      attendanceLogs: attendanceLogs.filter((log) => log.userId === userId),
      auditRecords: auditPage.records.filter(
        (record) => record.actorUserId === userId || (record.targetType === 'USER' && record.targetId === userId)
      )
    };
  }

  async deleteUserData(
    schoolId: string,
    userId: string,
    confirmationEmail: string,
    actorUserId: string
  ): Promise<{ deleted: { user: number; attendanceLogs: number } }> {
    if (userId === actorUserId) {
      throw new Error('You cannot erase your own account.');
    }

    const user = await this.requireSchoolUser(schoolId, userId);

    if (confirmationEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      throw new Error('Type the user email to confirm data erasure.');
    }

    const userDeleted = await this.userRepository.delete(userId, schoolId);

    if (!userDeleted) {
      throw new Error('User not found.');
    }

    const attendanceLogs = await this.attendanceRepository.deleteByUser(schoolId, userId);

    return { deleted: { user: 1, attendanceLogs } };
  }

  async deleteSchoolData(
    schoolId: string,
    confirmation: string,
    preserveUserId: string
  ): Promise<{ deleted: Record<string, number> }> {
    const school = await this.requireSchool(schoolId);

    if (confirmation !== school.slug) {
      throw new Error('Type the school slug to confirm data deletion.');
    }

    const attendanceLogs = await this.attendanceRepository.deleteBySchool(schoolId);
    const devices = await this.deviceRepository.deleteBySchool(schoolId);
    const users = await this.userRepository.deleteBySchoolExcept(schoolId, preserveUserId);

    return { deleted: { attendanceLogs, devices, users } };
  }

  async restoreSchool(schoolId: string, input: unknown): Promise<SchoolDataSnapshot> {
    const snapshot = this.parseSnapshot(input, schoolId);
    const previousSnapshot = await this.createSnapshot(schoolId);

    try {
      return await this.applySnapshot(schoolId, snapshot);
    } catch (restoreError) {
      try {
        await this.applySnapshot(schoolId, previousSnapshot);
      } catch (rollbackError) {
        const restoreMessage = restoreError instanceof Error ? restoreError.message : 'Unknown restore error.';
        const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : 'Unknown rollback error.';
        throw new Error(`School restore failed (${restoreMessage}) and rollback failed (${rollbackMessage}).`, {
          cause: rollbackError
        });
      }

      throw restoreError;
    }
  }

  private async applySnapshot(schoolId: string, snapshot: SchoolDataSnapshot): Promise<SchoolDataSnapshot> {
    await this.attendanceRepository.deleteBySchool(schoolId);
    await this.deviceRepository.deleteBySchool(schoolId);
    await this.userRepository.deleteBySchool(schoolId);

    const school = await this.tenantRepository.updateSchoolProfile(schoolId, {
      name: snapshot.school.name,
      logoUrl: snapshot.school.logoUrl,
      contactEmail: snapshot.school.contactEmail,
      theme: snapshot.school.theme
    });

    if (!school) {
      throw new Error('School not found.');
    }

    for (const user of snapshot.users) {
      await this.userRepository.create(user);
    }

    for (const device of snapshot.devices) {
      await this.deviceRepository.create(device);
    }

    for (const log of snapshot.attendanceLogs) {
      await this.attendanceRepository.restore(log);
    }

    return {
      ...snapshot,
      school
    };
  }

  private async createSnapshot(schoolId: string): Promise<SchoolDataSnapshot> {
    const [school, users, devices, attendanceLogs] = await Promise.all([
      this.requireSchool(schoolId),
      this.userRepository.listBySchool(schoolId),
      this.deviceRepository.listBySchool(schoolId),
      this.attendanceRepository.listAllBySchool(schoolId)
    ]);

    return {
      format: 'perl-school-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      school,
      users,
      devices,
      attendanceLogs
    };
  }

  private async requireSchool(schoolId: string) {
    const school = await this.tenantRepository.findSchoolById(schoolId);

    if (!school) {
      throw new Error('School not found.');
    }

    return school;
  }

  private async requireSchoolUser(schoolId: string, userId: string): Promise<UserRecord> {
    const user = await this.userRepository.findById(userId);

    if (!user || user.schoolId !== schoolId) {
      throw new Error('User not found.');
    }

    return user;
  }

  private parseSnapshot(input: unknown, schoolId: string): SchoolDataSnapshot {
    if (!isObject(input) || input.format !== 'perl-school-backup' || input.version !== 1) {
      throw new Error('A valid PERL school backup is required.');
    }

    if (
      !isSchoolProfile(input.school, schoolId) ||
      !isString(input.exportedAt) ||
      !Number.isFinite(Date.parse(input.exportedAt)) ||
      !Array.isArray(input.users) ||
      !Array.isArray(input.devices) ||
      !Array.isArray(input.attendanceLogs)
    ) {
      throw new Error('Backup school scope does not match the target school.');
    }

    const recordCount = input.users.length + input.devices.length + input.attendanceLogs.length;
    if (recordCount > maxBackupRecords) {
      throw new Error(`Backup exceeds the ${maxBackupRecords}-record restore limit.`);
    }

    if (
      !input.users.every((user) => isUserRecord(user, schoolId)) ||
      !input.devices.every((device) => isDeviceRecord(device, schoolId)) ||
      !input.attendanceLogs.every((log) => isAttendanceRecord(log, schoolId))
    ) {
      throw new Error('Backup contains invalid or cross-school records.');
    }

    const snapshot = input as unknown as SchoolDataSnapshot;
    const userIds = snapshot.users.map((user) => user.id);
    const deviceIds = snapshot.devices.map((device) => device.id);

    if (
      hasDuplicates(userIds) ||
      hasDuplicates(snapshot.users.map((user) => user.email.toLowerCase())) ||
      hasDuplicates(snapshot.users.flatMap((user) => (user.cardUid ? [user.cardUid] : []))) ||
      hasDuplicates(deviceIds) ||
      hasDuplicates(snapshot.devices.map((device) => device.keyHash)) ||
      hasDuplicates(snapshot.attendanceLogs.map((log) => log.id))
    ) {
      throw new Error('Backup contains duplicate identifiers or credentials.');
    }

    const userIdSet = new Set(userIds);
    const studentsById = new Set(
      snapshot.users.filter((user) => user.role === 'STUDENT').map((user) => user.id)
    );
    const deviceIdSet = new Set(deviceIds);
    if (
      snapshot.attendanceLogs.some(
        (log) =>
          (log.userId !== 'unknown-user' && !userIdSet.has(log.userId)) || !deviceIdSet.has(log.deviceId)
      ) ||
      snapshot.users.some(
        (user) =>
          (user.role !== 'GUARDIAN' && (user.linkedStudentIds?.length ?? 0) > 0) ||
          (user.linkedStudentIds ?? []).some((studentId) => !studentsById.has(studentId))
      )
    ) {
      throw new Error('Backup contains invalid user, guardian, attendance, or device references.');
    }

    return snapshot;
  }
}
