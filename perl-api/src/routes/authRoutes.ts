import { Router } from 'express';
import type { RepositorySet } from '../repositories/index.js';
import { createAuthController } from '../controllers/authController.js';
import { AuthService } from '../services/AuthService.js';
import { attachSessionUser } from '../middleware/authMiddleware.js';
import { createRateLimiter, resolveLoginRateLimitKey } from '../middleware/rateLimitMiddleware.js';
import { env } from '../config/env.js';

export const createAuthRoutes = (repositories: RepositorySet) => {
  const router = Router();
  const controller = createAuthController(repositories);
  const authService = new AuthService(
    repositories.userRepository,
    repositories.platformUserRepository
  );
  const loginRateLimiter = createRateLimiter({
    windowMs: env.rateLimits.loginWindowMs,
    maxRequests: env.rateLimits.loginMaxAttempts,
    key: resolveLoginRateLimitKey,
    message: 'Too many login attempts. Please try again later.'
  });

  router.post('/auth/login', loginRateLimiter, controller.login);
  router.post('/auth/logout', controller.logout);
  router.get('/auth/session', attachSessionUser(authService), controller.getSession);

  return router;
};
