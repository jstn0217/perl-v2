import type { Request, Response } from 'express';
import type { RepositorySet } from '../repositories/index.js';
import { AuditService } from '../services/AuditService.js';
import { TenantService } from '../services/TenantService.js';
import { readAuditFilters, sendAuditCsv } from './auditQuery.js';

const readPositiveInteger = (value: unknown, fallback: number, maximum: number) => {
  const parsed = Number.parseInt(typeof value === 'string' ? value : '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
};

export const createSupportController = (repositories: RepositorySet) => {
  const auditService = new AuditService(repositories.auditRepository);
  const tenantService = new TenantService(repositories.tenantRepository);

  return {
    async createSchool(req: Request, res: Response) {
      const actor = req.currentUser;
      if (!actor) return res.status(401).json({ message: 'Authentication required.' });

      try {
        const school = await tenantService.createSchool(req.body);
        await auditService.record(
          school.id,
          actor,
          'SCHOOL_CREATED',
          'SCHOOL',
          school.id,
          `Created school account ${school.name} (${school.slug})`
        );
        return res.status(201).json({ school });
      } catch (error) {
        return res.status(400).json({
          message: error instanceof Error ? error.message : 'Unable to create school.'
        });
      }
    },

    async listSchools(_req: Request, res: Response) {
      const schools = await repositories.tenantRepository.listSchools();
      return res.json({ schools });
    },

    async updateSchoolSmsSettings(req: Request, res: Response) {
      const actor = req.currentUser;
      if (!actor) return res.status(401).json({ message: 'Authentication required.' });
      const schoolId = typeof req.params.schoolId === 'string' ? req.params.schoolId : '';
      const { smsEnabled, smsSenderName } = req.body as {
        smsEnabled?: unknown;
        smsSenderName?: unknown;
      };

      if (typeof smsEnabled !== 'boolean') {
        return res.status(400).json({ message: 'smsEnabled must be true or false.' });
      }

      const senderName =
        typeof smsSenderName === 'string' && smsSenderName.trim()
          ? smsSenderName.trim().toUpperCase()
          : null;
      if (senderName && !/^[A-Z0-9 ]{1,11}$/.test(senderName)) {
        return res.status(400).json({
          message: 'SMS sender name must contain up to 11 letters, numbers, or spaces.'
        });
      }

      const school = await repositories.tenantRepository.updateSchoolProfile(schoolId, {
        smsEnabled,
        smsSenderName: senderName
      });
      if (!school) return res.status(404).json({ message: 'School not found.' });

      await auditService.record(
        school.id,
        actor,
        'SCHOOL_SMS_SETTINGS_UPDATED',
        'SCHOOL',
        school.id,
        `${smsEnabled ? 'Enabled' : 'Disabled'} SMS subscription${
          senderName ? ` with sender ${senderName}` : ''
        }`
      );
      return res.json({ school });
    },

    async listAuditLogs(req: Request, res: Response) {
      try {
        const page = readPositiveInteger(req.query.page, 1, Number.MAX_SAFE_INTEGER);
        const pageSize = readPositiveInteger(req.query.pageSize, 50, 100);
        const schoolId =
          typeof req.query.schoolId === 'string' && req.query.schoolId.length > 0
            ? req.query.schoolId
            : undefined;
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
      try {
        const schoolId =
          typeof req.query.schoolId === 'string' && req.query.schoolId.length > 0
            ? req.query.schoolId
            : undefined;
        const filters = readAuditFilters(req.query);
        const records = await auditService.exportFilteredRecords(filters, schoolId);
        return sendAuditCsv(
          res,
          `system-action-log-${new Date().toISOString().slice(0, 10)}.csv`,
          records,
          req.query.columns
        );
      } catch (error) {
        return res.status(400).json({
          message: error instanceof Error ? error.message : 'Unable to export audit logs.'
        });
      }
    },

    async accessSchool(req: Request, res: Response) {
      const schoolId = typeof req.params.schoolId === 'string' ? req.params.schoolId : '';
      const actor = req.currentUser;
      if (!actor) return res.status(401).json({ message: 'Authentication required.' });

      const school = await repositories.tenantRepository.findSchoolById(schoolId);
      if (!school) return res.status(404).json({ message: 'School not found.' });

      await auditService.record(
        schoolId,
        actor,
        'SUPPORT_CONTEXT_ACCESSED',
        'SCHOOL',
        schoolId,
        `System support opened the ${school.name} account context`
      );
      return res.json({ school });
    }
  };
};
