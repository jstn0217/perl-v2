import type { PlatformUserRole, UserRole } from '../types/User.js';

export const platformRoles: PlatformUserRole[] = ['SYSTEM_ADMIN', 'SUPPORT'];
export const systemAdministrationRoles: UserRole[] = ['SYSTEM_ADMIN'];
export const platformSupportRoles: UserRole[] = [...platformRoles];
// School-scoped read/write/monitor role lists (schoolReadRoles, schoolManagementRoles,
// liveMonitorRoles) were superseded by the permission catalog — see
// src/auth/permissionCatalog.ts and src/auth/rolePermissions.ts. Their effective
// ADMIN/STAFF/platform access is preserved exactly as ADMIN_DEFAULT_PERMISSIONS /
// STAFF_DEFAULT_PERMISSIONS / SUPPORT_PERMISSIONS there.
export const monitorDiagnosticRoles: UserRole[] = [...platformRoles];

export const isPlatformRole = (role: UserRole): role is PlatformUserRole =>
  platformRoles.includes(role as PlatformUserRole);
