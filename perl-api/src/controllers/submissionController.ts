import type { Request, Response } from 'express';
import type { RepositorySet } from '../repositories/index.js';
import { SubmissionService } from '../services/SubmissionService.js';
import { AuditService } from '../services/AuditService.js';
import { isPlatformRole } from '../auth/permissions.js';
import type { SubmissionStatus, SubmissionType } from '../types/Submission.js';
import { handleControllerError } from '../utils/errors.js';

const submissionTypes: SubmissionType[] = ['ENROLLMENT', 'INQUIRY'];
const submissionStatuses: SubmissionStatus[] = ['NEW', 'IN_REVIEW', 'ACCEPTED', 'DECLINED'];

const readRouteParam = (value: string | string[] | undefined) => (typeof value === 'string' ? value : null);

const readPositiveInteger = (value: unknown, fallback: number, maximum: number) => {
  const parsed = Number.parseInt(typeof value === 'string' ? value : '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
};

const readType = (value: unknown) =>
  typeof value === 'string' && submissionTypes.includes(value as SubmissionType)
    ? (value as SubmissionType)
    : undefined;

const readStatus = (value: unknown) =>
  typeof value === 'string' && submissionStatuses.includes(value as SubmissionStatus)
    ? (value as SubmissionStatus)
    : undefined;

const readSearch = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);
const readSort = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : 'createdAt');
const readSortDir = (value: unknown) => (value === 'asc' ? 'asc' : 'desc');

export const createSubmissionController = (repositories: RepositorySet) => {
  const submissionService = new SubmissionService(
    repositories.submissionRepository,
    repositories.tenantRepository
  );
  const auditService = new AuditService(repositories.auditRepository);

  const recordCrossSchoolRead = async (req: Request, schoolId: string, summary: string) => {
    const actor = req.currentUser;
    if (!actor || !isPlatformRole(actor.role) || actor.schoolId === schoolId) return;
    await auditService.record(schoolId, actor, 'SCHOOL_DATA_VIEWED', 'SCHOOL', schoolId, summary);
  };

  return {
    async list(req: Request, res: Response) {
      const schoolId = readRouteParam(req.params.schoolId);
      if (!schoolId) return res.status(400).json({ message: 'School scope is required.' });

      try {
        const page = readPositiveInteger(req.query.page, 1, Number.MAX_SAFE_INTEGER);
        const pageSize = readPositiveInteger(req.query.pageSize, 20, 100);
        const { items, total } = await submissionService.listPaged(schoolId, {
          page,
          pageSize,
          search: readSearch(req.query.search),
          sort: readSort(req.query.sort),
          dir: readSortDir(req.query.dir),
          type: readType(req.query.type),
          status: readStatus(req.query.status)
        });

        await recordCrossSchoolRead(req, schoolId, 'Viewed school submissions');

        return res.json({ submissions: items, total, page, pageSize });
      } catch (error) {
        return handleControllerError(res, error, 'submissionController.list');
      }
    },

    async create(req: Request, res: Response) {
      const actor = req.currentUser;
      const schoolId = readRouteParam(req.params.schoolId);
      if (!actor) return res.status(401).json({ message: 'Authentication required.' });
      if (!schoolId) return res.status(400).json({ message: 'School scope is required.' });

      try {
        const type = readType(req.body?.type);
        if (!type) {
          return res.status(400).json({ message: 'type must be ENROLLMENT or INQUIRY.' });
        }

        const submission = await submissionService.create(schoolId, type, 'MANUAL', req.body ?? {});
        await auditService.record(
          schoolId,
          actor,
          'SUBMISSION_CREATED',
          'SUBMISSION',
          submission.id,
          `Recorded a manual ${type.toLowerCase()} submission for ${submission.firstName} ${submission.lastName}`
        );

        return res.status(201).json({ submission });
      } catch (error) {
        return handleControllerError(res, error, 'submissionController.create');
      }
    },

    async update(req: Request, res: Response) {
      const actor = req.currentUser;
      const schoolId = readRouteParam(req.params.schoolId);
      const id = readRouteParam(req.params.id);
      if (!actor) return res.status(401).json({ message: 'Authentication required.' });
      if (!schoolId || !id) {
        return res.status(400).json({ message: 'School scope and submission ID are required.' });
      }

      try {
        const { status, notes } = req.body as { status?: unknown; notes?: unknown };
        const submission = await submissionService.updateStatusAndNotes(schoolId, id, {
          status: typeof status === 'string' ? status : undefined,
          notes: notes === null ? null : typeof notes === 'string' ? notes : undefined
        });
        await auditService.record(
          schoolId,
          actor,
          'SUBMISSION_UPDATED',
          'SUBMISSION',
          submission.id,
          'Updated submission status/notes'
        );

        return res.json({ submission });
      } catch (error) {
        return handleControllerError(res, error, 'submissionController.update');
      }
    }
  };
};
