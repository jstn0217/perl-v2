import { Router } from 'express';
import type { RepositorySet } from '../repositories/index.js';
import { createAuthController } from '../controllers/authController.js';
import { AuthService } from '../services/AuthService.js';
import { attachSessionUser } from '../middleware/authMiddleware.js';

export const createAuthRoutes = (repositories: RepositorySet) => {
  const router = Router();
  const controller = createAuthController(repositories);
  const authService = new AuthService(repositories.userRepository);

  router.post('/auth/login', controller.login);
  router.post('/auth/logout', controller.logout);
  router.get('/auth/session', attachSessionUser(authService), controller.getSession);

  return router;
};
