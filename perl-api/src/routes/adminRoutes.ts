import { Router } from 'express';
import { createAdminController } from '../controllers/adminController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import type { RepositorySet } from '../repositories/index.js';
import { AuthService } from '../services/AuthService.js';
import { uploadSingleImage } from '../middleware/imageUploadMiddleware.js';
import type { IImageStorage } from '../storage/IImageStorage.js';
import {
  schoolManagementRoles,
  schoolReadRoles
} from '../auth/permissions.js';
import { createNotificationController } from '../controllers/notificationController.js';

export const createAdminRoutes = (repositories: RepositorySet, imageStorage: IImageStorage) => {
  const router = Router();
  const controller = createAdminController(repositories, imageStorage);
  const notificationController = createNotificationController(repositories);
  const authService = new AuthService(
    repositories.userRepository,
    repositories.platformUserRepository
  );

  const schoolReadOnly = [
    requireAuth(authService),
    requireRole(authService, schoolReadRoles)
  ] as const;
  const schoolWriteOnly = [
    requireAuth(authService),
    requireRole(authService, schoolManagementRoles)
  ] as const;

  router.get(
    '/admin/schools/:schoolId/summary',
    ...schoolReadOnly,
    controller.getSchoolSummary
  );
  router.get('/admin/schools/:schoolId/profile', ...schoolReadOnly, controller.getSchoolProfile);
  router.patch('/admin/schools/:schoolId/profile', ...schoolWriteOnly, controller.updateSchoolProfile);
  router.post('/admin/schools/:schoolId/logo', ...schoolWriteOnly, uploadSingleImage, controller.uploadSchoolLogo);
  router.get('/admin/schools/:schoolId/users', ...schoolReadOnly, controller.listUsers);
  router.post('/admin/schools/:schoolId/users', ...schoolWriteOnly, controller.createUser);
  router.post('/admin/schools/:schoolId/users/import', ...schoolWriteOnly, controller.importUsers);
  router.patch('/admin/schools/:schoolId/users/:userId', ...schoolWriteOnly, controller.updateUser);
  router.post(
    '/admin/schools/:schoolId/users/:userId/image',
    ...schoolWriteOnly,
    uploadSingleImage,
    controller.uploadUserImage
  );
  router.post('/admin/schools/:schoolId/users/:userId/deactivate', ...schoolWriteOnly, controller.deactivateUser);
  router.get('/admin/schools/:schoolId/devices', ...schoolReadOnly, controller.listDevices);
  router.post('/admin/schools/:schoolId/devices', ...schoolWriteOnly, controller.registerDevice);
  router.post('/admin/schools/:schoolId/devices/:deviceId/rotate-key', ...schoolWriteOnly, controller.rotateDeviceKey);
  router.post('/admin/schools/:schoolId/devices/:deviceId/deactivate', ...schoolWriteOnly, controller.deactivateDevice);
  router.get('/admin/schools/:schoolId/export', ...schoolWriteOnly, controller.exportSchoolData);
  router.get('/admin/schools/:schoolId/backup', ...schoolWriteOnly, controller.backupSchoolData);
  router.get('/admin/schools/:schoolId/users/:userId/export', ...schoolWriteOnly, controller.exportUserData);
  router.delete('/admin/schools/:schoolId/users/:userId/data', ...schoolWriteOnly, controller.deleteUserData);
  router.delete('/admin/schools/:schoolId/data', ...schoolWriteOnly, controller.deleteSchoolData);
  router.post('/admin/schools/:schoolId/restore', ...schoolWriteOnly, controller.restoreSchoolData);
  router.get('/admin/schools/:schoolId/audit-logs', ...schoolReadOnly, controller.listAuditLogs);
  router.get('/admin/schools/:schoolId/audit-logs/export', ...schoolReadOnly, controller.exportAuditLogs);
  router.get(
    '/admin/schools/:schoolId/notifications',
    ...schoolReadOnly,
    notificationController.list
  );
  router.get(
    '/admin/schools/:schoolId/notifications/export',
    ...schoolReadOnly,
    notificationController.export
  );
  return router;
};
