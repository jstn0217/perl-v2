import type { Request, Response } from 'express';
import type { AuditAction, AuditRecord } from '../types/Audit.js';
import type { RepositorySet } from '../repositories/index.js';
import type { IImageStorage } from '../storage/IImageStorage.js';
import type { SchoolUserRole } from '../types/User.js';
import { AdminService } from '../services/AdminService.js';
import { AuditService } from '../services/AuditService.js';
import { DeviceService } from '../services/DeviceService.js';
import { SchoolDataService } from '../services/SchoolDataService.js';
import { ImageService } from '../services/ImageService.js';
import { readAuditFilters, sendAuditCsv } from './auditQuery.js';
import { isPlatformRole } from '../auth/permissions.js';
import { DomainError, handleControllerError } from '../utils/errors.js';

const readRouteParam = (value: string | string[] | undefined) => {
  return typeof value === 'string' ? value : null;
};

const readPositiveInteger = (value: unknown, fallback: number, maximum: number) => {
  const parsed = Number.parseInt(typeof value === 'string' ? value : '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
};

const readBoolean = (value: unknown) => value === 'true' || value === '1';

// Used for the picker/export code paths that need the school's full matching
// record set rather than a UI page (e.g. the guardian-linking student picker,
// full-result CSV export). Not a hard limit on school size, just a sane
// ceiling so a malformed request can't force an unbounded DB scan.
const UNBOUNDED_PAGE_SIZE = 100_000;

const userRoles = ['ADMIN', 'STAFF', 'STUDENT', 'GUARDIAN'];

const readUserRole = (value: unknown) =>
  typeof value === 'string' && userRoles.includes(value) ? (value as SchoolUserRole) : undefined;

const readStatus = (value: unknown) => (value === 'active' || value === 'inactive' ? value : undefined);

const readSortDir = (value: unknown) => (value === 'desc' ? 'desc' : 'asc');

const readSearch = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const readSort = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

export const createAdminController = (repositories: RepositorySet, imageStorage: IImageStorage) => {
  const adminService = new AdminService(
    repositories.tenantRepository,
    repositories.userRepository,
    repositories.roleRepository
  );
  const auditService = new AuditService(repositories.auditRepository);
  const deviceService = new DeviceService(repositories.deviceRepository);
  const imageService = new ImageService(
    imageStorage,
    repositories.tenantRepository,
    repositories.userRepository
  );
  const schoolDataService = new SchoolDataService(
    repositories.tenantRepository,
    repositories.userRepository,
    repositories.deviceRepository,
    repositories.attendanceRepository,
    repositories.auditRepository,
    repositories.submissionRepository
  );
  const recordAudit = async (
    req: Request,
    schoolId: string,
    action: AuditAction,
    targetType: AuditRecord['targetType'],
    targetId: string | null,
    explicitSummary?: string
  ) => {
    const actor = req.currentUser;
    if (!actor) throw new DomainError('Authentication required.', 401);
    const changedFields =
      req.body && typeof req.body === 'object'
        ? Object.keys(req.body).filter(
            (key) => !['password', 'confirmEmail', 'confirmSlug'].includes(key)
          )
        : [];
    const summary =
      explicitSummary ??
      `${action.replaceAll('_', ' ').toLowerCase()}${
        changedFields.length > 0 ? ` (${changedFields.join(', ')})` : ''
      }`;
    await auditService.record(schoolId, actor, action, targetType, targetId, summary);
  };

  // Audits only a platform-role (SUPPORT/SYSTEM_ADMIN) actor viewing a school
  // other than their own; ordinary school-user reads stay unaudited to avoid
  // log spam.
  const recordCrossSchoolRead = async (req: Request, schoolId: string, summary: string) => {
    const actor = req.currentUser;
    if (!actor || !isPlatformRole(actor.role) || actor.schoolId === schoolId) return;
    await auditService.record(schoolId, actor, 'SCHOOL_DATA_VIEWED', 'SCHOOL', schoolId, summary);
  };

  return {
    async getSchoolSummary(req: Request, res: Response) {
      try {
        const schoolId = readRouteParam(req.params.schoolId);

        if (!schoolId) {
          return res.status(400).json({ message: 'School scope is required.' });
        }

        const summary = await adminService.getSchoolSummary(schoolId);
        await recordCrossSchoolRead(req, schoolId, 'Viewed school summary');

        return res.json(summary);
      } catch (error) {
        return handleControllerError(res, error, 'adminController.getSchoolSummary');
      }
    },

    async getSchoolProfile(req: Request, res: Response) {
      try {
        const schoolId = readRouteParam(req.params.schoolId);

        if (!schoolId) {
          return res.status(400).json({ message: 'School scope is required.' });
        }

        const school = await adminService.getSchoolProfile(schoolId);
        await recordCrossSchoolRead(req, schoolId, 'Viewed school profile');

        return res.json({ school });
      } catch (error) {
        return handleControllerError(res, error, 'adminController.getSchoolProfile');
      }
    },

    async updateSchoolProfile(req: Request, res: Response) {
      try {
        const schoolId = readRouteParam(req.params.schoolId);

        if (!schoolId) {
          return res.status(400).json({ message: 'School scope is required.' });
        }

        const school = await adminService.updateSchoolProfile(schoolId, req.body);
        await recordAudit(req, schoolId, 'SCHOOL_PROFILE_UPDATED', 'SCHOOL', schoolId);

        return res.json({ school });
      } catch (error) {
        return handleControllerError(res, error, 'adminController.updateSchoolProfile');
      }
    },

    async uploadSchoolLogo(req: Request, res: Response) {
      try {
        const schoolId = readRouteParam(req.params.schoolId);
        if (!schoolId) return res.status(400).json({ message: 'School scope is required.' });
        if (!req.file) return res.status(400).json({ message: 'Image file is required.' });

        const school = await imageService.uploadSchoolLogo(schoolId, {
          buffer: req.file.buffer,
          contentType: req.file.mimetype
        });
        await recordAudit(req, schoolId, 'SCHOOL_LOGO_UPDATED', 'SCHOOL', schoolId);
        return res.json({ school });
      } catch (error) {
        return handleControllerError(res, error, 'adminController.uploadSchoolLogo');
      }
    },

    async listUsers(req: Request, res: Response) {
      try {
        const schoolId = readRouteParam(req.params.schoolId);

        if (!schoolId) {
          return res.status(400).json({ message: 'School scope is required.' });
        }

        const wantsAll = readBoolean(req.query.all);
        const page = wantsAll ? 1 : readPositiveInteger(req.query.page, 1, Number.MAX_SAFE_INTEGER);
        const pageSize = wantsAll ? UNBOUNDED_PAGE_SIZE : readPositiveInteger(req.query.pageSize, 20, 100);
        const { items, total } = await adminService.listUsersPaged(schoolId, {
          page,
          pageSize,
          search: readSearch(req.query.search),
          sort: readSort(req.query.sort),
          dir: readSortDir(req.query.dir),
          role: readUserRole(req.query.role),
          status: readStatus(req.query.status)
        });

        await recordCrossSchoolRead(req, schoolId, 'Viewed school users');

        return res.json({ users: items, total, page, pageSize });
      } catch (error) {
        return handleControllerError(res, error, 'adminController.listUsers');
      }
    },

    async createUser(req: Request, res: Response) {
      try {
        const schoolId = readRouteParam(req.params.schoolId);

        if (!schoolId) {
          return res.status(400).json({ message: 'School scope is required.' });
        }

        const user = await adminService.createUser(schoolId, req.body);
        await recordAudit(req, schoolId, 'USER_CREATED', 'USER', user.id);

        return res.status(201).json({ user });
      } catch (error) {
        return handleControllerError(res, error, 'adminController.createUser');
      }
    },

    async importUsers(req: Request, res: Response) {
      try {
        const schoolId = readRouteParam(req.params.schoolId);
        if (!schoolId) return res.status(400).json({ message: 'School scope is required.' });
        const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
        const result = await adminService.importUsers(schoolId, rows);
        await recordAudit(
          req,
          schoolId,
          'USERS_IMPORTED',
          'SCHOOL',
          schoolId,
          `Imported ${result.created.length} school users, updated ${result.updated.length}; ${result.errors.length} rows failed`
        );
        return res.status(result.errors.length > 0 ? 207 : 201).json(result);
      } catch (error) {
        // Import validation failures (missing school, bad row count) are always
        // reported as 400 here, regardless of the underlying DomainError's own
        // status code, to match this route's existing contract.
        if (error instanceof DomainError) {
          return res.status(400).json({ message: error.message });
        }
        console.error('[adminController.importUsers]', error);
        return res.status(500).json({ error: 'Internal server error' });
      }
    },

    async updateUser(req: Request, res: Response) {
      try {
        const schoolId = readRouteParam(req.params.schoolId);
        const userId = readRouteParam(req.params.userId);

        if (!schoolId || !userId) {
          return res.status(400).json({ message: 'School scope and user ID are required.' });
        }

        const user = await adminService.updateUser(schoolId, userId, req.body);
        await recordAudit(req, schoolId, 'USER_UPDATED', 'USER', userId);

        return res.json({ user });
      } catch (error) {
        return handleControllerError(res, error, 'adminController.updateUser');
      }
    },

    async uploadUserImage(req: Request, res: Response) {
      try {
        const schoolId = readRouteParam(req.params.schoolId);
        const userId = readRouteParam(req.params.userId);
        if (!schoolId || !userId) {
          return res.status(400).json({ message: 'School scope and user ID are required.' });
        }
        if (!req.file) return res.status(400).json({ message: 'Image file is required.' });

        const user = await imageService.uploadUserImage(schoolId, userId, {
          buffer: req.file.buffer,
          contentType: req.file.mimetype
        });
        await recordAudit(req, schoolId, 'USER_IMAGE_UPDATED', 'USER', userId);
        return res.json({ user });
      } catch (error) {
        return handleControllerError(res, error, 'adminController.uploadUserImage');
      }
    },

    async deactivateUser(req: Request, res: Response) {
      try {
        const actorUserId = req.currentUser?.id;
        const schoolId = readRouteParam(req.params.schoolId);
        const userId = readRouteParam(req.params.userId);

        if (!actorUserId) {
          return res.status(401).json({ message: 'Authentication required.' });
        }

        if (!schoolId || !userId) {
          return res.status(400).json({ message: 'School scope and user ID are required.' });
        }

        const user = await adminService.deactivateUser(schoolId, userId, actorUserId);
        await recordAudit(req, schoolId, 'USER_DEACTIVATED', 'USER', userId);

        return res.json({ user });
      } catch (error) {
        return handleControllerError(res, error, 'adminController.deactivateUser');
      }
    },

    async reactivateUser(req: Request, res: Response) {
      try {
        const schoolId = readRouteParam(req.params.schoolId);
        const userId = readRouteParam(req.params.userId);

        if (!schoolId || !userId) {
          return res.status(400).json({ message: 'School scope and user ID are required.' });
        }

        const user = await adminService.reactivateUser(schoolId, userId);
        await recordAudit(req, schoolId, 'USER_REACTIVATED', 'USER', userId);

        return res.json({ user });
      } catch (error) {
        return handleControllerError(res, error, 'adminController.reactivateUser');
      }
    },

    async bulkSetUserStatus(req: Request, res: Response) {
      try {
        const actorUserId = req.currentUser?.id;
        const schoolId = readRouteParam(req.params.schoolId);

        if (!actorUserId) {
          return res.status(401).json({ message: 'Authentication required.' });
        }

        if (!schoolId) {
          return res.status(400).json({ message: 'School scope is required.' });
        }

        const userIds = Array.isArray(req.body?.userIds) ? req.body.userIds : [];
        const isActive = req.body?.isActive === true;

        const result = await adminService.bulkSetUserStatus(schoolId, userIds, isActive, actorUserId);
        await recordAudit(
          req,
          schoolId,
          isActive ? 'USER_REACTIVATED' : 'USER_DEACTIVATED',
          'SCHOOL',
          schoolId,
          `Bulk ${isActive ? 'activated' : 'deactivated'} ${result.updated.length} user(s); ${
            result.errors.length
          } failed`
        );

        return res.json(result);
      } catch (error) {
        return handleControllerError(res, error, 'adminController.bulkSetUserStatus');
      }
    },

    async listAssignableRoles(req: Request, res: Response) {
      try {
        const schoolId = readRouteParam(req.params.schoolId);

        if (!schoolId) {
          return res.status(400).json({ message: 'School scope is required.' });
        }

        const roles = await adminService.listAssignableRoles();
        await recordCrossSchoolRead(req, schoolId, 'Viewed assignable roles');

        return res.json({ roles });
      } catch (error) {
        return handleControllerError(res, error, 'adminController.listAssignableRoles');
      }
    },

    async listDevices(req: Request, res: Response) {
      try {
        const schoolId = readRouteParam(req.params.schoolId);

        if (!schoolId) {
          return res.status(400).json({ message: 'School scope is required.' });
        }

        const wantsAll = readBoolean(req.query.all);
        const page = wantsAll ? 1 : readPositiveInteger(req.query.page, 1, Number.MAX_SAFE_INTEGER);
        const pageSize = wantsAll ? UNBOUNDED_PAGE_SIZE : readPositiveInteger(req.query.pageSize, 20, 100);
        const { items, total } = await deviceService.listDevicesPaged(schoolId, {
          page,
          pageSize,
          search: readSearch(req.query.search),
          sort: readSort(req.query.sort),
          dir: readSortDir(req.query.dir),
          status: readStatus(req.query.status)
        });

        await recordCrossSchoolRead(req, schoolId, 'Viewed school devices');

        return res.json({ devices: items, total, page, pageSize });
      } catch (error) {
        return handleControllerError(res, error, 'adminController.listDevices');
      }
    },

    async registerDevice(req: Request, res: Response) {
      try {
        const schoolId = readRouteParam(req.params.schoolId);

        if (!schoolId) {
          return res.status(400).json({ message: 'School scope is required.' });
        }

        const { name, location } = req.body as {
          name?: string;
          location?: string;
        };

        const registeredDevice = await deviceService.registerDevice(schoolId, name, location);
        await recordAudit(req, schoolId, 'DEVICE_REGISTERED', 'DEVICE', registeredDevice.device.id);

        return res.status(201).json(registeredDevice);
      } catch (error) {
        return handleControllerError(res, error, 'adminController.registerDevice');
      }
    },

    async rotateDeviceKey(req: Request, res: Response) {
      try {
        const schoolId = readRouteParam(req.params.schoolId);
        const deviceId = readRouteParam(req.params.deviceId);
        if (!schoolId || !deviceId) {
          return res.status(400).json({ message: 'School scope and device ID are required.' });
        }

        const registeredDevice = await deviceService.rotateDeviceKey(schoolId, deviceId);
        await recordAudit(req, schoolId, 'DEVICE_KEY_ROTATED', 'DEVICE', deviceId);
        return res.json(registeredDevice);
      } catch (error) {
        return handleControllerError(res, error, 'adminController.rotateDeviceKey');
      }
    },

    async deactivateDevice(req: Request, res: Response) {
      try {
        const schoolId = readRouteParam(req.params.schoolId);
        const deviceId = readRouteParam(req.params.deviceId);
        if (!schoolId || !deviceId) {
          return res.status(400).json({ message: 'School scope and device ID are required.' });
        }

        const device = await deviceService.deactivateDevice(schoolId, deviceId);
        await recordAudit(req, schoolId, 'DEVICE_DEACTIVATED', 'DEVICE', deviceId);
        return res.json({ device });
      } catch (error) {
        return handleControllerError(res, error, 'adminController.deactivateDevice');
      }
    },

    async exportSchoolData(req: Request, res: Response) {
      try {
        const schoolId = readRouteParam(req.params.schoolId);
        if (!schoolId) return res.status(400).json({ message: 'School scope is required.' });
        const data = await schoolDataService.exportSchool(schoolId);
        await recordAudit(req, schoolId, 'SCHOOL_DATA_EXPORTED', 'SCHOOL', schoolId);
        res.setHeader('Content-Disposition', `attachment; filename="${schoolId}-export.json"`);
        return res.json(data);
      } catch (error) {
        return handleControllerError(res, error, 'adminController.exportSchoolData');
      }
    },

    async backupSchoolData(req: Request, res: Response) {
      try {
        const schoolId = readRouteParam(req.params.schoolId);
        if (!schoolId) return res.status(400).json({ message: 'School scope is required.' });
        const data = await schoolDataService.backupSchool(schoolId);
        await recordAudit(req, schoolId, 'SCHOOL_BACKUP_CREATED', 'SCHOOL', schoolId);
        res.setHeader('Content-Disposition', `attachment; filename="${schoolId}-backup.json"`);
        return res.json(data);
      } catch (error) {
        return handleControllerError(res, error, 'adminController.backupSchoolData');
      }
    },

    async exportUserData(req: Request, res: Response) {
      try {
        const schoolId = readRouteParam(req.params.schoolId);
        const userId = readRouteParam(req.params.userId);
        if (!schoolId || !userId) {
          return res.status(400).json({ message: 'School scope and user ID are required.' });
        }
        const data = await schoolDataService.exportUser(schoolId, userId);
        await recordAudit(req, schoolId, 'USER_DATA_EXPORTED', 'USER', userId);
        res.setHeader('Content-Disposition', `attachment; filename="${userId}-export.json"`);
        return res.json(data);
      } catch (error) {
        return handleControllerError(res, error, 'adminController.exportUserData');
      }
    },

    async deleteUserData(req: Request, res: Response) {
      try {
        const actorUserId = req.currentUser?.id;
        const schoolId = readRouteParam(req.params.schoolId);
        const userId = readRouteParam(req.params.userId);
        if (!actorUserId) return res.status(401).json({ message: 'Authentication required.' });
        if (!schoolId || !userId) {
          return res.status(400).json({ message: 'School scope and user ID are required.' });
        }
        const confirmationEmail = typeof req.body?.confirmEmail === 'string' ? req.body.confirmEmail : '';
        const result = await schoolDataService.deleteUserData(
          schoolId,
          userId,
          confirmationEmail,
          actorUserId
        );
        await recordAudit(req, schoolId, 'USER_DATA_ERASED', 'USER', userId);
        return res.json(result);
      } catch (error) {
        return handleControllerError(res, error, 'adminController.deleteUserData');
      }
    },

    async deleteSchoolData(req: Request, res: Response) {
      try {
        const schoolId = readRouteParam(req.params.schoolId);
        if (!schoolId) return res.status(400).json({ message: 'School scope is required.' });
        const actorUserId = req.currentUser?.id;
        if (!actorUserId) return res.status(401).json({ message: 'Authentication required.' });
        const result = await schoolDataService.deleteSchoolData(schoolId, req.body?.confirmSlug, actorUserId);
        await recordAudit(req, schoolId, 'SCHOOL_DATA_ERASED', 'SCHOOL', schoolId);
        return res.json(result);
      } catch (error) {
        return handleControllerError(res, error, 'adminController.deleteSchoolData');
      }
    },

    async restoreSchoolData(req: Request, res: Response) {
      try {
        const schoolId = readRouteParam(req.params.schoolId);
        if (!schoolId) return res.status(400).json({ message: 'School scope is required.' });
        const data = await schoolDataService.restoreSchool(schoolId, req.body);
        await recordAudit(req, schoolId, 'SCHOOL_BACKUP_RESTORED', 'SCHOOL', schoolId);
        return res.json({ restored: true, counts: {
          users: data.users.length,
          devices: data.devices.length,
          attendanceLogs: data.attendanceLogs.length,
          submissions: data.submissions.length
        }});
      } catch (error) {
        return handleControllerError(res, error, 'adminController.restoreSchoolData');
      }
    },

    async listAuditLogs(req: Request, res: Response) {
      const schoolId = readRouteParam(req.params.schoolId);
      if (!schoolId) return res.status(400).json({ message: 'School scope is required.' });

      try {
        const page = readPositiveInteger(req.query.page, 1, Number.MAX_SAFE_INTEGER);
        const pageSize = readPositiveInteger(req.query.pageSize, 50, 100);
        const filters = readAuditFilters(req.query);
        const auditPage = await auditService.listFilteredRecords(
          page,
          pageSize,
          filters,
          schoolId
        );
        await recordCrossSchoolRead(req, schoolId, 'Viewed school audit logs');
        return res.json(auditPage);
      } catch (error) {
        return handleControllerError(res, error, 'adminController.listAuditLogs');
      }
    },

    async exportAuditLogs(req: Request, res: Response) {
      const schoolId = readRouteParam(req.params.schoolId);
      if (!schoolId) return res.status(400).json({ message: 'School scope is required.' });

      try {
        const filters = readAuditFilters(req.query);
        const records = await auditService.exportFilteredRecords(filters, schoolId);
        const school = await adminService.getSchoolProfile(schoolId);
        return sendAuditCsv(
          res,
          `${school.slug}-action-log-${new Date().toISOString().slice(0, 10)}.csv`,
          records,
          req.query.columns
        );
      } catch (error) {
        return handleControllerError(res, error, 'adminController.exportAuditLogs');
      }
    }
  };
};
