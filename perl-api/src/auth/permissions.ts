import type { PlatformUserRole, UserRole } from '../types/User.js';

export const platformRoles: PlatformUserRole[] = ['SYSTEM_ADMIN', 'SUPPORT'];
export const systemAdministrationRoles: UserRole[] = ['SYSTEM_ADMIN'];
export const platformSupportRoles: UserRole[] = [...platformRoles];
export const schoolReadRoles: UserRole[] = ['ADMIN', ...platformRoles];
export const schoolManagementRoles: UserRole[] = ['ADMIN', 'SYSTEM_ADMIN'];
export const liveMonitorRoles: UserRole[] = ['ADMIN', 'STAFF', ...platformRoles];
export const monitorDiagnosticRoles: UserRole[] = [...platformRoles];

export const isPlatformRole = (role: UserRole): role is PlatformUserRole =>
  platformRoles.includes(role as PlatformUserRole);
