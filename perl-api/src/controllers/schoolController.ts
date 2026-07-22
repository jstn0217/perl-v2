import type { Request, Response } from 'express';
import { TenantService } from '../services/TenantService.js';
import type { RepositorySet } from '../repositories/index.js';

export const createSchoolController = (repositories: RepositorySet) => {
  const tenantService = new TenantService(repositories.tenantRepository);

  return {
    async getCurrentSchool(req: Request, res: Response) {
      const requestedSlug = typeof req.query.school === 'string' ? req.query.school : undefined;
      const schoolContext = await tenantService.getSchoolContext(requestedSlug);

      res.json(schoolContext);
    }
  };
};
