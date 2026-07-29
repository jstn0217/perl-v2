import { env } from '../config/env.js';
import type { ISmsGateway } from '../notifications/index.js';
import type { INotificationRepository } from '../repositories/interfaces/INotificationRepository.js';
import type { ITenantRepository } from '../repositories/interfaces/ITenantRepository.js';
import type { IUserRepository } from '../repositories/interfaces/IUserRepository.js';
import type {
  NotificationFilters,
  NotificationPage,
  NotificationTransaction
} from '../types/Notification.js';
import type { AttendanceDirection } from '../types/Attendance.js';
import type { UserRecord } from '../types/User.js';

const normalizePhilippineMobile = (value: string | null | undefined) => {
  const digits = value?.replace(/\D/g, '') ?? '';
  if (/^09\d{9}$/.test(digits)) return `63${digits.slice(1)}`;
  if (/^639\d{9}$/.test(digits)) return digits;
  return null;
};

export class NotificationService {
  constructor(
    private readonly notificationRepository: INotificationRepository,
    private readonly userRepository: IUserRepository,
    private readonly tenantRepository: ITenantRepository,
    private readonly smsGateway: ISmsGateway
  ) {}

  async queueStudentAttendance(
    student: UserRecord,
    attendanceLogId: string,
    direction: AttendanceDirection,
    scannedAt: string
  ) {
    const school = await this.tenantRepository.findSchoolById(student.schoolId);
    if (!school) return;

    const message = `${student.firstName} ${student.lastName} logged ${direction === 'IN' ? 'in' : 'out'} at ${school.name} on ${new Intl.DateTimeFormat('en-PH', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Manila'
    }).format(new Date(scannedAt))}.`;
    const guardians = (await this.userRepository.listBySchool(student.schoolId)).filter(
      (user) =>
        user.role === 'GUARDIAN' &&
        user.isActive &&
        (user.linkedStudentIds ?? []).includes(student.id)
    );

    if (!school.smsEnabled || !this.smsGateway.enabled) {
      await this.createSkipped(
        student,
        attendanceLogId,
        direction,
        message,
        null,
        null,
        school.smsEnabled
          ? 'SMS delivery is disabled in the system environment.'
          : 'The school SMS subscription is disabled.'
      );
      return;
    }

    if (guardians.length === 0) {
      await this.createSkipped(
        student,
        attendanceLogId,
        direction,
        message,
        null,
        null,
        'No active guardian is linked to this student.'
      );
      return;
    }

    for (const guardian of guardians) {
      const recipient = normalizePhilippineMobile(guardian.phoneNumber);
      if (!recipient) {
        await this.createSkipped(
          student,
          attendanceLogId,
          direction,
          message,
          guardian,
          null,
          'Guardian has no valid Philippine mobile number.'
        );
        continue;
      }

      const transaction = await this.notificationRepository.create({
        schoolId: student.schoolId,
        attendanceLogId,
        studentUserId: student.id,
        guardianUserId: guardian.id,
        recipient,
        direction,
        message,
        provider: this.smsGateway.provider,
        status: 'QUEUED',
        providerMessageId: null,
        providerStatus: null,
        network: null,
        errorMessage: null,
        createdAt: new Date().toISOString(),
        completedAt: null
      });
      void this.deliver(transaction, school.smsSenderName ?? env.sms.senderName);
    }
  }

  async list(
    schoolId: string,
    page: number,
    pageSize: number,
    filters: NotificationFilters = {}
  ): Promise<NotificationPage> {
    const records = await this.filter(schoolId, filters);
    const start = (page - 1) * pageSize;
    return {
      records: records.slice(start, start + pageSize),
      total: records.length,
      page,
      pageSize
    };
  }

  async export(schoolId: string, filters: NotificationFilters = {}) {
    return this.filter(schoolId, filters);
  }

  private async filter(schoolId: string, filters: NotificationFilters) {
    const search = filters.search?.trim().toLocaleLowerCase();
    return (await this.notificationRepository.listAllBySchool(schoolId)).filter((record) => {
      if (filters.status && record.status !== filters.status) return false;
      if (filters.direction && record.direction !== filters.direction) return false;
      if (filters.from && Date.parse(record.createdAt) < Date.parse(filters.from)) return false;
      if (filters.to && Date.parse(record.createdAt) > Date.parse(filters.to)) return false;
      if (
        search &&
        ![
          record.recipient,
          record.message,
          record.providerMessageId,
          record.providerStatus,
          record.errorMessage
        ].some((value) => value?.toLocaleLowerCase().includes(search))
      ) {
        return false;
      }
      return true;
    });
  }

  private async createSkipped(
    student: UserRecord,
    attendanceLogId: string,
    direction: AttendanceDirection,
    message: string,
    guardian: UserRecord | null,
    recipient: string | null,
    reason: string
  ) {
    await this.notificationRepository.create({
      schoolId: student.schoolId,
      attendanceLogId,
      studentUserId: student.id,
      guardianUserId: guardian?.id ?? null,
      recipient,
      direction,
      message,
      provider: this.smsGateway.provider,
      status: 'SKIPPED',
      providerMessageId: null,
      providerStatus: null,
      network: null,
      errorMessage: reason,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString()
    });
  }

  private async deliver(transaction: NotificationTransaction, senderName: string) {
    try {
      const result = await this.smsGateway.send({
        recipient: transaction.recipient!,
        message: transaction.message,
        senderName
      });
      await this.notificationRepository.update(transaction.id, {
        recipient: result.recipient,
        status: 'SENT',
        providerMessageId: result.messageId,
        providerStatus: result.status,
        network: result.network,
        completedAt: new Date().toISOString()
      });
    } catch (error) {
      await this.notificationRepository.update(transaction.id, {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'SMS delivery failed.',
        completedAt: new Date().toISOString()
      });
    }
  }
}
