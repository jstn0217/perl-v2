import type { Request, Response } from 'express';
import type { RepositorySet } from '../repositories/index.js';
import { AttendanceService } from '../services/AttendanceService.js';
import { AuditService } from '../services/AuditService.js';
import { attendanceEventBus } from '../services/AttendanceEventBus.js';
import { DeviceService } from '../services/DeviceService.js';
import { TenantService } from '../services/TenantService.js';
import type { AttendanceFilters, AttendanceLogListItem } from '../types/Attendance.js';
import type { SessionUser } from '../types/User.js';
import {
  readSelectedCsvColumns,
  sendCsvColumnDownload,
  type CsvColumn
} from '../utils/csv.js';
import { isPlatformRole, monitorDiagnosticRoles } from '../auth/permissions.js';
import { resolveUserPermissions } from '../auth/rolePermissions.js';
import type { ISmsGateway } from '../notifications/index.js';
import { NotificationService } from '../services/NotificationService.js';
import { DomainError, handleControllerError } from '../utils/errors.js';

const resolvePositiveInt = (value: unknown, fallback: number) => {
  const parsed =
    typeof value === 'string' ? Number.parseInt(value, 10) : typeof value === 'number' ? value : fallback;

  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const readAttendanceFilters = (query: Request['query']): AttendanceFilters => {
  const readText = (value: unknown) =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
  const verdict = readText(query.verdict);
  const direction = readText(query.direction);
  const from = readText(query.from);
  const to = readText(query.to);

  if (verdict && !['ADMITTED', 'DENIED'].includes(verdict)) {
    throw new DomainError('Invalid attendance verdict filter.');
  }
  if (direction && !['IN', 'OUT'].includes(direction)) {
    throw new DomainError('Invalid attendance direction filter.');
  }
  if (from && Number.isNaN(Date.parse(from))) {
    throw new DomainError('Invalid attendance start date.');
  }
  if (to && Number.isNaN(Date.parse(to))) {
    throw new DomainError('Invalid attendance end date.');
  }
  if (from && to && Date.parse(from) > Date.parse(to)) {
    throw new DomainError('Attendance start date must be before the end date.');
  }

  return {
    search: readText(query.search),
    verdict: verdict as AttendanceFilters['verdict'],
    direction: direction as AttendanceFilters['direction'],
    from,
    to
  };
};

const attendanceExportColumns: CsvColumn<AttendanceLogListItem>[] = [
  {
    key: 'scannedAt',
    label: 'Scanned at',
    value: (record) => record.log.scannedAt
  },
  {
    key: 'student',
    label: 'Person',
    value: (record) =>
      record.student
        ? `${record.student.firstName} ${record.student.lastName}`
        : 'Unknown card'
  },
  {
    key: 'role',
    label: 'Role',
    value: (record) => record.student?.role ?? ''
  },
  {
    key: 'gradeLevel',
    label: 'Grade level',
    value: (record) => record.student?.gradeLevel ?? ''
  },
  {
    key: 'section',
    label: 'Section',
    value: (record) => record.student?.section ?? ''
  },
  {
    key: 'verdict',
    label: 'Verdict',
    value: (record) => record.log.verdict
  },
  {
    key: 'direction',
    label: 'Direction',
    value: (record) => record.log.direction
  },
  {
    key: 'device',
    label: 'Device',
    value: (record) => record.device?.name ?? 'Unknown device'
  },
  {
    key: 'location',
    label: 'Location',
    value: (record) => record.device?.location ?? ''
  },
  {
    key: 'message',
    label: 'Message',
    value: (record) => record.log.message
  }
];

export const createAttendanceController = (
  repositories: RepositorySet,
  smsGateway: ISmsGateway
) => {
  const tenantService = new TenantService(repositories.tenantRepository);
  const notificationService = new NotificationService(
    repositories.notificationRepository,
    repositories.userRepository,
    repositories.tenantRepository,
    smsGateway,
    tenantService
  );
  const attendanceService = new AttendanceService(
    repositories.attendanceRepository,
    repositories.deviceRepository,
    repositories.userRepository,
    repositories.tenantRepository,
    notificationService
  );
  const auditService = new AuditService(repositories.auditRepository);
  const deviceService = new DeviceService(repositories.deviceRepository);

  const resolveAuthorizedSchoolId = async (req: Request) => {
    const currentUser = req.currentUser;

    if (!currentUser) {
      throw new DomainError('Authentication required.', 401);
    }

    const schoolSlug = typeof req.query.school === 'string' ? req.query.school : undefined;

    if (!isPlatformRole(currentUser.role) && currentUser.schoolId) {
      return currentUser.schoolId;
    }

    if (!schoolSlug) {
      throw new DomainError('School context is required.');
    }

    const school = await tenantService.getCurrentSchool(schoolSlug);
    return school.id;
  };

  const resolveVisibleUserIds = async (currentUser: SessionUser) => {
    if (currentUser.role === 'STUDENT') return [currentUser.id];
    if (currentUser.role === 'GUARDIAN') {
      const guardian = await repositories.userRepository.findById(currentUser.id);
      return guardian?.linkedStudentIds ?? [];
    }
    return null;
  };

  return {
    async scanCard(req: Request, res: Response) {
      const { cardUid, schoolSlug } = req.body as {
        cardUid?: string;
        schoolSlug?: string;
      };
      const deviceKeyHeader = req.header('x-device-key');

      if (typeof cardUid !== 'string' || cardUid.trim().length === 0) {
        return res.status(400).json({ message: 'cardUid is required.' });
      }

      try {
        if (deviceKeyHeader) {
          const device = await deviceService.authenticateDeviceKey(deviceKeyHeader);

          if (schoolSlug) {
            const school = await tenantService.getCurrentSchool(schoolSlug);

            if (school.id !== device.schoolId) {
              return res.status(403).json({ message: 'Device key does not match the requested school.' });
            }
          }

          const result = await attendanceService.scanCard(device.schoolId, cardUid, new Date().toISOString(), device.id);

          return res.status(result.verdict === 'ADMITTED' ? 200 : 400).json(result);
        }

        const currentUser = req.currentUser;

        if (!currentUser) {
          return res.status(401).json({ message: 'Device key or authenticated school session is required.' });
        }

        if (!monitorDiagnosticRoles.includes(currentUser.role)) {
          return res.status(403).json({
            message: 'Browser scan simulation is restricted to system support.'
          });
        }

        if (isPlatformRole(currentUser.role) && !schoolSlug) {
          return res.status(400).json({ message: 'School context is required.' });
        }

        const schoolId =
          isPlatformRole(currentUser.role)
            ? (await tenantService.getCurrentSchool(schoolSlug)).id
            : currentUser.schoolId;
        if (!schoolId) {
          return res.status(400).json({ message: 'School context is required.' });
        }

        const result = await attendanceService.scanCard(schoolId, cardUid);

        if (isPlatformRole(currentUser.role)) {
          await auditService.record(
            schoolId,
            currentUser,
            'SUPPORT_SCAN_SIMULATED',
            'SCHOOL',
            schoolId,
            `Simulated scan for card ${cardUid} (${result.verdict})`
          );
        }

        return res.status(result.verdict === 'ADMITTED' ? 200 : 400).json(result);
      } catch (error) {
        return handleControllerError(res, error, 'attendanceController.scanCard');
      }
    },

    async connectDevice(req: Request, res: Response) {
      const { deviceKey } = req.body as { deviceKey?: string };

      if (!deviceKey) {
        return res.status(400).json({ message: 'deviceKey is required.' });
      }

      try {
        const device = await deviceService.authenticateDeviceKey(deviceKey);

        return res.status(200).json({
          device: {
            id: device.id,
            name: device.name,
            location: device.location
          }
        });
      } catch {
        return res.status(401).json({ message: 'Invalid device key.' });
      }
    },

    async listLogs(req: Request, res: Response) {
      let schoolId: string;
      let filters: AttendanceFilters;

      try {
        schoolId = await resolveAuthorizedSchoolId(req);
        filters = readAttendanceFilters(req.query);
      } catch (error) {
        return handleControllerError(res, error, 'attendanceController.listLogs');
      }

      const page = resolvePositiveInt(req.query.page, 1);
      const pageSize = Math.min(resolvePositiveInt(req.query.pageSize, 10), 50);
      const currentUser = req.currentUser;
      if (!currentUser) {
        return res.status(401).json({ message: 'Authentication required.' });
      }

      if (isPlatformRole(currentUser.role)) {
        await auditService.record(
          schoolId,
          currentUser,
          'ATTENDANCE_LOGS_VIEWED',
          'SCHOOL',
          schoolId,
          'Viewed attendance logs'
        );
      }

      try {
        const visibleUserIds = await resolveVisibleUserIds(currentUser);
        const payload = visibleUserIds
          ? await attendanceService.listUserLogs(schoolId, visibleUserIds, page, pageSize, filters)
          : await attendanceService.listSchoolLogs(schoolId, page, pageSize, filters);

        return res.json(payload);
      } catch (error) {
        return handleControllerError(res, error, 'attendanceController.listLogs');
      }
    },

    async exportLogs(req: Request, res: Response) {
      const currentUser = req.currentUser;
      if (!currentUser) return res.status(401).json({ message: 'Authentication required.' });

      try {
        const schoolId = await resolveAuthorizedSchoolId(req);
        const filters = readAttendanceFilters(req.query);
        const columns = readSelectedCsvColumns(req.query.columns, attendanceExportColumns);
        const visibleUserIds = await resolveVisibleUserIds(currentUser);
        const records = visibleUserIds
          ? await attendanceService.exportUserLogs(schoolId, visibleUserIds, filters)
          : await attendanceService.exportSchoolLogs(schoolId, filters);
        const school = await tenantService.getSchoolById(schoolId);
        await auditService.record(
          schoolId,
          currentUser,
          'ATTENDANCE_EXPORTED',
          'SCHOOL',
          schoolId,
          `Exported ${records.length} filtered attendance records`
        );

        return sendCsvColumnDownload(
          res,
          `${school.slug}-attendance-${new Date().toISOString().slice(0, 10)}.csv`,
          columns,
          records
        );
      } catch (error) {
        return handleControllerError(res, error, 'attendanceController.exportLogs');
      }
    },

    async streamEvents(req: Request, res: Response) {
      if (!req.currentUser) {
        return res.status(403).json({ message: 'Live attendance monitoring is staff-only.' });
      }

      const permissions = await resolveUserPermissions(req.currentUser, repositories.roleRepository);

      if (!permissions.includes('monitor.live')) {
        return res.status(403).json({ message: 'Live attendance monitoring is staff-only.' });
      }

      let schoolId: string;

      try {
        schoolId = await resolveAuthorizedSchoolId(req);
      } catch (error) {
        return handleControllerError(res, error, 'attendanceController.streamEvents');
      }

      if (isPlatformRole(req.currentUser.role)) {
        await auditService.record(
          schoolId,
          req.currentUser,
          'ATTENDANCE_STREAM_OPENED',
          'SCHOOL',
          schoolId,
          'Opened live attendance stream'
        );
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      const unsubscribe = attendanceEventBus.subscribe(schoolId, (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      });

      req.on('close', () => {
        unsubscribe();
        res.end();
      });
    }
  };
};
