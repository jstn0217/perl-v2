import { Router } from 'express';
import { createAttendanceController } from '../controllers/attendanceController.js';
import { attachSessionUser, requireAuth } from '../middleware/authMiddleware.js';
import { createRateLimiter, resolveDeviceScanRateLimitKey } from '../middleware/rateLimitMiddleware.js';
import type { RepositorySet } from '../repositories/index.js';
import { AuthService } from '../services/AuthService.js';
import { env } from '../config/env.js';
import type { ISmsGateway } from '../notifications/index.js';

export const createAttendanceRoutes = (repositories: RepositorySet, smsGateway: ISmsGateway) => {
  const router = Router();
  const controller = createAttendanceController(repositories, smsGateway);
  const authService = new AuthService(
    repositories.userRepository,
    repositories.platformUserRepository
  );
  const deviceScanRateLimiter = createRateLimiter({
    windowMs: env.rateLimits.deviceScanWindowMs,
    maxRequests: env.rateLimits.deviceScanMaxAttempts,
    key: resolveDeviceScanRateLimitKey,
    message: 'Too many scan attempts. Please try again later.'
  });

  router.post('/device/scan', deviceScanRateLimiter, attachSessionUser(authService), controller.scanCard);
  router.get('/attendance/logs', requireAuth(authService), controller.listLogs);
  router.get('/attendance/export', requireAuth(authService), controller.exportLogs);
  router.get('/attendance/stream', requireAuth(authService), controller.streamEvents);

  return router;
};
