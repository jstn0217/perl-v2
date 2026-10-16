import type { IAttendanceRepository } from '../repositories/interfaces/IAttendanceRepository.js';
import type { IAuditRepository } from '../repositories/interfaces/IAuditRepository.js';
import type { IDeviceRepository } from '../repositories/interfaces/IDeviceRepository.js';
import type { ISubmissionRepository } from '../repositories/interfaces/ISubmissionRepository.js';
import type { ITenantRepository } from '../repositories/interfaces/ITenantRepository.js';
import type { IUserRepository } from '../repositories/interfaces/IUserRepository.js';
import type { SchoolDataExport, SchoolDataSnapshot, UserDataExport } from '../types/SchoolData.js';
import type { AttendanceLogRecord } from '../types/Attendance.js';
import type { DeviceRecord } from '../types/Device.js';
import type { SchoolProfile } from '../types/SchoolProfile.js';
import type { SubmissionRecord } from '../types/Submission.js';
import type { UserRecord } from '../types/User.js';
import { ADDRESS_FIELD_KEYS } from '../types/Address.js';
import { DomainError } from '../utils/errors.js';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const isString = (value: unknown): value is string => typeof value === 'string';
const isNullableString = (value: unknown): value is string | null => value === null || isString(value);
// Structured address fields didn't exist in backups taken before this feature shipped,
// so a missing key (undefined) is accepted here alongside null/string.
const isOptionalNullableString = (value: unknown): value is string | null | undefined =>
  value === undefined || isNullableString(value);
const hasStructuredAddressFields = (value: Record<string, unknown>): boolean =>
  ADDRESS_FIELD_KEYS.every((key) => isOptionalNullableString(value[key]));
const hexColorPattern = /^#[0-9a-fA-F]{6}$/;
const hashPattern = /^[0-9a-f]{64}$/;
const maxBackupRecords = 100_000;

// Backups taken before structured addresses shipped carry a single legacy `address`
// string instead of the six structured fields. Maps that legacy value onto
// addressLine1 so old backups keep restoring instead of failing validation.
const migrateLegacyAddress = <T extends Record<string, unknown>>(record: T): T => {
  const hasStructuredValue = ADDRESS_FIELD_KEYS.some((key) => {
    const value = record[key];
    return typeof value === 'string' && value.trim().length > 0;
  });
  const legacyAddress = record.address;

  if (!hasStructuredValue && typeof legacyAddress === 'string' && legacyAddress.trim().length > 0) {
    return { ...record, addressLine1: legacyAddress };
  }

  return record;
};

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
    hexColorPattern.test(value.theme.accentColor) &&
    hasStructuredAddressFields(value)
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
    typeof value.isActive === 'boolean' &&
    hasStructuredAddressFields(value)
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

const submissionTypes = ['ENROLLMENT', 'INQUIRY'];
const submissionStatuses = ['NEW', 'IN_REVIEW', 'ACCEPTED', 'DECLINED'];
const submissionSources = ['PUBLIC', 'MANUAL'];

const isSubmissionRecord = (value: unknown, schoolId: string): value is SubmissionRecord => {
  if (!isObject(value)) return false;

  return (
    isString(value.id) &&
    value.schoolId === schoolId &&
    submissionTypes.includes(String(value.type)) &&
    submissionStatuses.includes(String(value.status)) &&
    submissionSources.includes(String(value.source)) &&
    isString(value.firstName) &&
    isString(value.lastName) &&
    isString(value.email) &&
    isNullableString(value.phone) &&
    isNullableString(value.gradeLevelApplying) &&
    isNullableString(value.guardianName) &&
    isNullableString(value.message) &&
    isNullableString(value.notes) &&
    isString(value.createdAt) &&
    Number.isFinite(Date.parse(value.createdAt)) &&
    isString(value.updatedAt) &&
    Number.isFinite(Date.parse(value.updatedAt)) &&
    hasStructuredAddressFields(value)
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
    private readonly auditRepository: IAuditRepository,
    private readonly submissionRepository: ISubmissionRepository
  ) {}

  async exportSchool(schoolId: string): Promise<SchoolDataExport> {
    const [snapshot, auditPage] = await Promise.all([
      this.createSnapshot(schoolId),
      this.auditRepository.listBySchool(schoolId, 1, maxBackupRecords)
    ]);

    return {
      format: 'perl-school-export',
      version: 2,
      exportedAt: snapshot.exportedAt,
      school: snapshot.school,
      users: snapshot.users.map(toPortableUser),
      devices: snapshot.devices.map(toPortableDevice),
      attendanceLogs: snapshot.attendanceLogs,
      auditRecords: auditPage.records,
      submissions: snapshot.submissions
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
      throw new DomainError('You cannot erase your own account.');
    }

    const user = await this.requireSchoolUser(schoolId, userId);

    if (confirmationEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      throw new DomainError('Type the user email to confirm data erasure.');
    }

    const userDeleted = await this.userRepository.delete(userId, schoolId);

    if (!userDeleted) {
      throw new DomainError('User not found.', 404);
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
      throw new DomainError('Type the school slug to confirm data deletion.');
    }

    const attendanceLogs = await this.attendanceRepository.deleteBySchool(schoolId);
    const devices = await this.deviceRepository.deleteBySchool(schoolId);
    const submissions = await this.submissionRepository.deleteBySchool(schoolId);
    const users = await this.userRepository.deleteBySchoolExcept(schoolId, preserveUserId);

    return { deleted: { attendanceLogs, devices, submissions, users } };
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
        // Both the restore and the rollback failed: the school may be in a partial state.
        // Thrown as a plain Error so the controller logs the detail server-side and the
        // client gets a generic 500 instead of internal repository/DB messages.
        throw new Error(
          `School restore failed (${restoreMessage}) and rollback also failed (${rollbackMessage}).`,
          { cause: rollbackError }
        );
      }

      if (restoreError instanceof DomainError) {
        throw restoreError;
      }
      // Repository-level failures (mock uniqueness checks, DB constraint errors) carry
      // internal detail that must not reach the client — surface a stable message instead.
      throw new DomainError(
        'School restore failed: the backup could not be applied. Previous data was restored.',
        400,
        { cause: restoreError }
      );
    }
  }

  private async applySnapshot(schoolId: string, snapshot: SchoolDataSnapshot): Promise<SchoolDataSnapshot> {
    await this.attendanceRepository.deleteBySchool(schoolId);
    await this.deviceRepository.deleteBySchool(schoolId);
    await this.submissionRepository.deleteBySchool(schoolId);
    await this.userRepository.deleteBySchool(schoolId);

    const school = await this.tenantRepository.updateSchoolProfile(schoolId, {
      name: snapshot.school.name,
      logoUrl: snapshot.school.logoUrl,
      contactEmail: snapshot.school.contactEmail,
      theme: snapshot.school.theme,
      phone: snapshot.school.phone,
      timezone: snapshot.school.timezone,
      academicYearLabel: snapshot.school.academicYearLabel,
      depedSchoolId: snapshot.school.depedSchoolId,
      addressLine1: snapshot.school.addressLine1,
      addressLine2: snapshot.school.addressLine2,
      barangay: snapshot.school.barangay,
      city: snapshot.school.city,
      province: snapshot.school.province,
      zipCode: snapshot.school.zipCode
    });

    if (!school) {
      throw new DomainError('School not found.', 404);
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

    for (const submission of snapshot.submissions) {
      await this.submissionRepository.create(submission);
    }

    return {
      ...snapshot,
      school
    };
  }

  private async createSnapshot(schoolId: string): Promise<SchoolDataSnapshot> {
    const [school, users, devices, attendanceLogs, submissions] = await Promise.all([
      this.requireSchool(schoolId),
      this.userRepository.listBySchool(schoolId),
      this.deviceRepository.listBySchool(schoolId),
      this.attendanceRepository.listAllBySchool(schoolId),
      this.submissionRepository.listAllBySchool(schoolId)
    ]);

    return {
      format: 'perl-school-backup',
      version: 2,
      exportedAt: new Date().toISOString(),
      school,
      users,
      devices,
      attendanceLogs,
      submissions
    };
  }

  private async requireSchool(schoolId: string) {
    const school = await this.tenantRepository.findSchoolById(schoolId);

    if (!school) {
      throw new DomainError('School not found.', 404);
    }

    return school;
  }

  private async requireSchoolUser(schoolId: string, userId: string): Promise<UserRecord> {
    const user = await this.userRepository.findById(userId);

    if (!user || user.schoolId !== schoolId) {
      throw new DomainError('User not found.', 404);
    }

    return user;
  }

  private parseSnapshot(input: unknown, schoolId: string): SchoolDataSnapshot {
    if (!isObject(input) || input.format !== 'perl-school-backup' || input.version !== 2) {
      throw new DomainError('A valid Perfect Learning (AMoS) school backup is required.');
    }

    if (
      !isObject(input.school) ||
      !isString(input.exportedAt) ||
      !Number.isFinite(Date.parse(input.exportedAt)) ||
      !Array.isArray(input.users) ||
      !Array.isArray(input.devices) ||
      !Array.isArray(input.attendanceLogs) ||
      !Array.isArray(input.submissions)
    ) {
      throw new DomainError('Backup school scope does not match the target school.');
    }

    // Backups taken before structured addresses shipped carry a single legacy
    // `address` string per record instead of the six structured fields — map it
    // onto addressLine1 before validating, so old backups still restore cleanly.
    const migratedSchool = migrateLegacyAddress(input.school);
    const migratedUsers = input.users.map((user) => (isObject(user) ? migrateLegacyAddress(user) : user));
    const migratedSubmissions = input.submissions.map((submission) =>
      isObject(submission) ? migrateLegacyAddress(submission) : submission
    );

    if (!isSchoolProfile(migratedSchool, schoolId)) {
      throw new DomainError('Backup school scope does not match the target school.');
    }

    const recordCount =
      migratedUsers.length + input.devices.length + input.attendanceLogs.length + migratedSubmissions.length;
    if (recordCount > maxBackupRecords) {
      throw new DomainError(`Backup exceeds the ${maxBackupRecords}-record restore limit.`);
    }

    if (
      !migratedUsers.every((user) => isUserRecord(user, schoolId)) ||
      !input.devices.every((device) => isDeviceRecord(device, schoolId)) ||
      !input.attendanceLogs.every((log) => isAttendanceRecord(log, schoolId)) ||
      !migratedSubmissions.every((submission) => isSubmissionRecord(submission, schoolId))
    ) {
      throw new DomainError('Backup contains invalid or cross-school records.');
    }

    const snapshot = {
      ...input,
      school: migratedSchool,
      users: migratedUsers,
      submissions: migratedSubmissions
    } as unknown as SchoolDataSnapshot;
    const userIds = snapshot.users.map((user) => user.id);
    const deviceIds = snapshot.devices.map((device) => device.id);

    if (
      hasDuplicates(userIds) ||
      hasDuplicates(snapshot.users.map((user) => user.email.toLowerCase())) ||
      hasDuplicates(snapshot.users.flatMap((user) => (user.cardUid ? [user.cardUid] : []))) ||
      hasDuplicates(deviceIds) ||
      hasDuplicates(snapshot.devices.map((device) => device.keyHash)) ||
      hasDuplicates(snapshot.attendanceLogs.map((log) => log.id)) ||
      hasDuplicates(snapshot.submissions.map((submission) => submission.id))
    ) {
      throw new DomainError('Backup contains duplicate identifiers or credentials.');
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
      throw new DomainError('Backup contains invalid user, guardian, attendance, or device references.');
    }

    return snapshot;
  }
}
