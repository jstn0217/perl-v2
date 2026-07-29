import type { Request, Response } from 'express';
import { TenantService } from '../services/TenantService.js';
import type { RepositorySet } from '../repositories/index.js';

export const createSchoolController = (repositories: RepositorySet) => {
  const tenantService = new TenantService(repositories.tenantRepository);

  return {
    async getCurrentSchool(req: Request, res: Response) {
      const schoolId = req.currentUser?.schoolId;

      if (!schoolId) {
        return res.status(400).json({ message: 'Select a school through the support workspace.' });
      }

      const school = await tenantService.getSchoolById(schoolId);
      return res.json({ school });
    }
  };
};
