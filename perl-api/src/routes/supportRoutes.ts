import { Router } from 'express';
import { createSupportController } from '../controllers/supportController.js';
import { requireAuth, requireUserRole } from '../middleware/authMiddleware.js';
import type { RepositorySet } from '../repositories/index.js';
import { AuthService } from '../services/AuthService.js';
import {
  platformSupportRoles,
  systemAdministrationRoles
} from '../auth/permissions.js';

export const createSupportRoutes = (repositories: RepositorySet) => {
  const router = Router();
  const controller = createSupportController(repositories);
  const authService = new AuthService(
    repositories.userRepository,
    repositories.platformUserRepository
  );
  const supportOnly = [
    requireAuth(authService),
    requireUserRole(platformSupportRoles)
  ] as const;
  const systemAdminOnly = [
    requireAuth(authService),
    requireUserRole(systemAdministrationRoles)
  ] as const;

  router.get('/support/schools', ...supportOnly, controller.listSchools);
  router.post('/support/schools', ...systemAdminOnly, controller.createSchool);
  router.patch(
    '/support/schools/:schoolId/sms-settings',
    ...systemAdminOnly,
    controller.updateSchoolSmsSettings
  );
  router.post('/support/schools/:schoolId/access', ...supportOnly, controller.accessSchool);
  router.get('/support/audit-logs', ...supportOnly, controller.listAuditLogs);
  router.get('/support/audit-logs/export', ...supportOnly, controller.exportAuditLogs);

  return router;
};
