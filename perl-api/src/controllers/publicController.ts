import type { Request, Response } from 'express';
import type { RepositorySet } from '../repositories/index.js';
import { SubmissionService, type SubmissionInput } from '../services/SubmissionService.js';
import { TenantService } from '../services/TenantService.js';
import type { SubmissionType } from '../types/Submission.js';
import { handleControllerError } from '../utils/errors.js';

const readSlug = (value: string | string[] | undefined) => (typeof value === 'string' ? value : null);

const isHoneypotFilled = (body: unknown) =>
  typeof (body as { website?: unknown })?.website === 'string' &&
  (body as { website: string }).website.trim().length > 0;

const readSubmissionInput = (body: unknown): SubmissionInput => {
  const source = (body ?? {}) as Record<string, unknown>;
  const readString = (value: unknown) => (typeof value === 'string' ? value : undefined);

  return {
    firstName: readString(source.firstName),
    lastName: readString(source.lastName),
    email: readString(source.email),
    phone: readString(source.phone) ?? null,
    gradeLevelApplying: readString(source.gradeLevelApplying) ?? null,
    guardianName: readString(source.guardianName) ?? null,
    message: readString(source.message) ?? null,
    addressLine1: readString(source.addressLine1) ?? null,
    addressLine2: readString(source.addressLine2) ?? null,
    barangay: readString(source.barangay) ?? null,
    city: readString(source.city) ?? null,
    province: readString(source.province) ?? null,
    zipCode: readString(source.zipCode) ?? null
  };
};

export const createPublicController = (repositories: RepositorySet) => {
  const tenantService = new TenantService(repositories.tenantRepository);
  const submissionService = new SubmissionService(
    repositories.submissionRepository,
    repositories.tenantRepository
  );

  const createSubmission = async (req: Request, res: Response, type: SubmissionType) => {
    const slug = readSlug(req.params.slug);
    if (!slug) return res.status(400).json({ message: 'School is required.' });

    try {
      const school = await repositories.tenantRepository.findSchoolBySlug(slug);
      if (!school) return res.status(404).json({ message: 'Not found.' });

      if (isHoneypotFilled(req.body)) {
        return res.status(201).json({ message: 'Submission received.' });
      }

      await submissionService.createPublic(school, type, readSubmissionInput(req.body));

      return res.status(201).json({ message: 'Submission received.' });
    } catch (error) {
      return handleControllerError(res, error, 'publicController.createSubmission');
    }
  };

  return {
    async getIntake(req: Request, res: Response) {
      const slug = readSlug(req.params.slug);
      if (!slug) return res.status(400).json({ message: 'School is required.' });

      try {
        const school = await repositories.tenantRepository.findSchoolBySlug(slug);
        if (!school) return res.status(404).json({ message: 'Not found.' });

        return res.json({
          school: { name: school.name, logoUrl: school.logoUrl, theme: school.theme },
          enrollmentEnabled: tenantService.isFeatureEnabled(school, 'enrollment'),
          inquiryEnabled: tenantService.isFeatureEnabled(school, 'inquiry')
        });
      } catch (error) {
        return handleControllerError(res, error, 'publicController.getIntake');
      }
    },

    async createEnrollment(req: Request, res: Response) {
      return createSubmission(req, res, 'ENROLLMENT');
    },

    async createInquiry(req: Request, res: Response) {
      return createSubmission(req, res, 'INQUIRY');
    }
  };
};
