import { Router } from 'express';
import { createAdminController } from '../controllers/adminController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import type { RepositorySet } from '../repositories/index.js';
import { AuthService } from '../services/AuthService.js';

export const createAdminRoutes = (repositories: RepositorySet) => {
  const router = Router();
  const controller = createAdminController();
  const authService = new AuthService(repositories.userRepository);

  router.get(
    '/admin/schools/:schoolId/summary',
    requireAuth(authService),
    requireRole(authService, ['ADMIN']),
    controller.getSchoolSummary
  );

  return router;
};
