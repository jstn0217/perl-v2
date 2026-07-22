import type { Request, Response } from 'express';
import { HealthService } from '../services/HealthService.js';
import type { RepositorySet } from '../repositories/index.js';

export const createHealthController = (repositories: RepositorySet) => {
  const healthService = new HealthService(repositories);

  return {
    getHealth(_req: Request, res: Response) {
      res.json(healthService.getStatus());
    }
  };
};
