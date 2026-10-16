import { Router } from 'express';
import { createAdminController } from '../controllers/adminController.js';
import { requireAuth, requirePermission } from '../middleware/authMiddleware.js';
import type { RepositorySet } from '../repositories/index.js';
import { AuthService } from '../services/AuthService.js';
import { uploadSingleImage } from '../middleware/imageUploadMiddleware.js';
import type { IImageStorage } from '../storage/IImageStorage.js';
import type { PermissionKey } from '../auth/permissionCatalog.js';
import { createNotificationController } from '../controllers/notificationController.js';
import { createSubmissionController } from '../controllers/submissionController.js';

export const createAdminRoutes = (repositories: RepositorySet, imageStorage: IImageStorage) => {
  const router = Router();
  const controller = createAdminController(repositories, imageStorage);
  const notificationController = createNotificationController(repositories);
  const submissionController = createSubmissionController(repositories);
  const authService = new AuthService(
    repositories.userRepository,
    repositories.platformUserRepository
  );

  const permission = (key: PermissionKey) =>
    [requireAuth(authService), requirePermission(authService, repositories.roleRepository, key)] as const;

  const schoolReadOnly = permission('school.records.read');
  const schoolProfileWrite = permission('school.profile.manage');
  const schoolUsersWrite = permission('school.users.manage');
  const schoolDevicesWrite = permission('school.devices.manage');
  const schoolDataWrite = permission('school.data.manage');
  const schoolSubmissionsWrite = permission('school.submissions.manage');

  router.get(
    '/admin/schools/:schoolId/summary',
    ...schoolReadOnly,
    controller.getSchoolSummary
  );
  router.get('/admin/schools/:schoolId/profile', ...schoolReadOnly, controller.getSchoolProfile);
  router.patch('/admin/schools/:schoolId/profile', ...schoolProfileWrite, controller.updateSchoolProfile);
  router.post('/admin/schools/:schoolId/logo', ...schoolProfileWrite, uploadSingleImage, controller.uploadSchoolLogo);
  router.get('/admin/schools/:schoolId/users', ...schoolReadOnly, controller.listUsers);
  router.post('/admin/schools/:schoolId/users', ...schoolUsersWrite, controller.createUser);
  router.post('/admin/schools/:schoolId/users/import', ...schoolUsersWrite, controller.importUsers);
  router.patch('/admin/schools/:schoolId/users/bulk-status', ...schoolUsersWrite, controller.bulkSetUserStatus);
  router.patch('/admin/schools/:schoolId/users/:userId', ...schoolUsersWrite, controller.updateUser);
  router.post(
    '/admin/schools/:schoolId/users/:userId/image',
    ...schoolUsersWrite,
    uploadSingleImage,
    controller.uploadUserImage
  );
  router.post('/admin/schools/:schoolId/users/:userId/deactivate', ...schoolUsersWrite, controller.deactivateUser);
  router.post('/admin/schools/:schoolId/users/:userId/reactivate', ...schoolUsersWrite, controller.reactivateUser);
  router.get('/admin/schools/:schoolId/assignable-roles', ...schoolUsersWrite, controller.listAssignableRoles);
  router.get('/admin/schools/:schoolId/devices', ...schoolReadOnly, controller.listDevices);
  router.post('/admin/schools/:schoolId/devices', ...schoolDevicesWrite, controller.registerDevice);
  router.post('/admin/schools/:schoolId/devices/:deviceId/rotate-key', ...schoolDevicesWrite, controller.rotateDeviceKey);
  router.post('/admin/schools/:schoolId/devices/:deviceId/deactivate', ...schoolDevicesWrite, controller.deactivateDevice);
  router.get('/admin/schools/:schoolId/export', ...schoolDataWrite, controller.exportSchoolData);
  router.get('/admin/schools/:schoolId/backup', ...schoolDataWrite, controller.backupSchoolData);
  router.get('/admin/schools/:schoolId/users/:userId/export', ...schoolDataWrite, controller.exportUserData);
  router.delete('/admin/schools/:schoolId/users/:userId/data', ...schoolDataWrite, controller.deleteUserData);
  router.delete('/admin/schools/:schoolId/data', ...schoolDataWrite, controller.deleteSchoolData);
  router.post('/admin/schools/:schoolId/restore', ...schoolDataWrite, controller.restoreSchoolData);
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
  router.get(
    '/admin/schools/:schoolId/submissions',
    ...schoolSubmissionsWrite,
    submissionController.list
  );
  router.post(
    '/admin/schools/:schoolId/submissions',
    ...schoolSubmissionsWrite,
    submissionController.create
  );
  router.patch(
    '/admin/schools/:schoolId/submissions/:id',
    ...schoolSubmissionsWrite,
    submissionController.update
  );
  return router;
};
