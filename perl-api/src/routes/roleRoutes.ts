import { Router } from 'express';
import { createRoleController } from '../controllers/roleController.js';
import { requireAuth, requireUserRole } from '../middleware/authMiddleware.js';
import type { RepositorySet } from '../repositories/index.js';
import { AuthService } from '../services/AuthService.js';
import { platformSupportRoles, systemAdministrationRoles } from '../auth/permissions.js';

export const createRoleRoutes = (repositories: RepositorySet) => {
  const router = Router();
  const controller = createRoleController(repositories);
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

  router.get('/support/permissions/catalog', ...supportOnly, controller.getPermissionCatalog);
  router.get('/support/roles', ...supportOnly, controller.list);
  router.post('/support/roles', ...systemAdminOnly, controller.create);
  router.patch('/support/roles/:id', ...systemAdminOnly, controller.update);
  router.patch('/support/roles/:id/deactivate', ...systemAdminOnly, controller.deactivate);
  router.patch('/support/roles/:id/reactivate', ...systemAdminOnly, controller.reactivate);

  return router;
};
