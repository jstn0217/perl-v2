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
  const adminService = new AdminService(repositories.tenantRepository, repositories.userRepository);
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
    repositories.auditRepository
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
    if (!actor) throw new Error('Authentication required.');
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

  return {
    async getSchoolSummary(req: Request, res: Response) {
      try {
        const schoolId = readRouteParam(req.params.schoolId);

        if (!schoolId) {
          return res.status(400).json({ message: 'School scope is required.' });
        }

        const summary = await adminService.getSchoolSummary(schoolId);

        return res.json(summary);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load school summary.';

        return res.status(message === 'School not found.' ? 404 : 400).json({ message });
      }
    },

    async getSchoolProfile(req: Request, res: Response) {
      try {
        const schoolId = readRouteParam(req.params.schoolId);

        if (!schoolId) {
          return res.status(400).json({ message: 'School scope is required.' });
        }

        const school = await adminService.getSchoolProfile(schoolId);

        return res.json({ school });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load school profile.';

        return res.status(message === 'School not found.' ? 404 : 400).json({ message });
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
        const message = error instanceof Error ? error.message : 'Unable to update school profile.';
        const status = message === 'School not found.' ? 404 : 400;

        return res.status(status).json({ message });
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
        const message = error instanceof Error ? error.message : 'Unable to upload school logo.';
        return res.status(message === 'School not found.' ? 404 : 400).json({ message });
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

        return res.json({ users: items, total, page, pageSize });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load users.';

        return res.status(message === 'School not found.' ? 404 : 400).json({ message });
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
        const message = error instanceof Error ? error.message : 'Unable to create user.';
        const status = message === 'School not found.' ? 404 : 400;

        return res.status(status).json({ message });
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
          `Imported ${result.created.length} school users; ${result.errors.length} rows failed`
        );
        return res.status(result.errors.length > 0 ? 207 : 201).json(result);
      } catch (error) {
        return res.status(400).json({
          message: error instanceof Error ? error.message : 'Unable to import school users.'
        });
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
        const message = error instanceof Error ? error.message : 'Unable to update user.';
        const status = message === 'User not found.' || message === 'School not found.' ? 404 : 400;

        return res.status(status).json({ message });
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
        const message = error instanceof Error ? error.message : 'Unable to upload user image.';
        return res.status(message === 'User not found.' ? 404 : 400).json({ message });
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
        const message = error instanceof Error ? error.message : 'Unable to deactivate user.';
        const status = message === 'User not found.' || message === 'School not found.' ? 404 : 400;

        return res.status(status).json({ message });
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

        return res.json({ devices: items, total, page, pageSize });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load devices.';

        return res.status(400).json({ message });
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
        const message = error instanceof Error ? error.message : 'Unable to register device.';

        return res.status(400).json({ message });
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
        const message = error instanceof Error ? error.message : 'Unable to rotate device key.';
        return res.status(message === 'Device not found.' ? 404 : 400).json({ message });
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
        const message = error instanceof Error ? error.message : 'Unable to deactivate device.';
        return res.status(message === 'Device not found.' ? 404 : 400).json({ message });
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
        const message = error instanceof Error ? error.message : 'Unable to export school data.';
        return res.status(message === 'School not found.' ? 404 : 400).json({ message });
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
        const message = error instanceof Error ? error.message : 'Unable to create school backup.';
        return res.status(message === 'School not found.' ? 404 : 400).json({ message });
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
        const message = error instanceof Error ? error.message : 'Unable to export user data.';
        return res.status(message === 'School not found.' || message === 'User not found.' ? 404 : 400).json({ message });
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
        const message = error instanceof Error ? error.message : 'Unable to erase user data.';
        return res.status(message === 'School not found.' || message === 'User not found.' ? 404 : 400).json({ message });
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
        const message = error instanceof Error ? error.message : 'Unable to delete school data.';
        return res.status(message === 'School not found.' ? 404 : 400).json({ message });
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
          attendanceLogs: data.attendanceLogs.length
        }});
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to restore school data.';
        return res.status(message === 'School not found.' ? 404 : 400).json({ message });
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
        return res.json(auditPage);
      } catch (error) {
        return res.status(400).json({
          message: error instanceof Error ? error.message : 'Unable to load audit logs.'
        });
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
        return res.status(400).json({
          message: error instanceof Error ? error.message : 'Unable to export audit logs.'
        });
      }
    }
  };
};
