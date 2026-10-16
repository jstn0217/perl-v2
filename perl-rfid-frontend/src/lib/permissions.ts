import type { UserRole } from '../types/admin';

export const isSystemAdministrator = (role: UserRole | undefined) => role === 'SYSTEM_ADMIN';
export const isSupportAgent = (role: UserRole | undefined) => role === 'SUPPORT';
export const isPlatformUser = (role: UserRole | undefined) =>
  isSystemAdministrator(role) || isSupportAgent(role);
export const isPlatformSupport = isPlatformUser;
export const isSchoolAdministrator = (role: UserRole | undefined) => role === 'ADMIN';
export const canManageSchool = (role: UserRole | undefined) =>
  isSchoolAdministrator(role) || isSystemAdministrator(role);
export const canViewSchoolWorkspace = (role: UserRole | undefined) =>
  canManageSchool(role) || isSupportAgent(role);
// SUPPORT can manage a selected school's profile, users, and devices within its
// support context (not school data management or submissions, which stay
// ADMIN/SYSTEM_ADMIN-only) — the same role set that can view the workspace.
export const canManageSchoolResources = canViewSchoolWorkspace;
export const canViewLiveMonitor = (role: UserRole | undefined) =>
  role === 'ADMIN' || role === 'STAFF' || isPlatformUser(role);
export const canUseMonitorDiagnostics = isPlatformSupport;
export const canProvisionSchools = isSystemAdministrator;
export const canManageRoles = isSystemAdministrator;
export const canToggleSchoolFeatures = isPlatformUser;
export const canManageSubmissions = canManageSchool;
