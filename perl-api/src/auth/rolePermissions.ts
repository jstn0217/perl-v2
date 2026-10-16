import { ALL_PERMISSION_KEYS, type PermissionKey } from './permissionCatalog.js';
import type { IRoleRepository } from '../repositories/interfaces/IRoleRepository.js';
import type { RoleListItem } from '../types/Role.js';
import type { SessionUser } from '../types/User.js';

// Fixed IDs for the virtual built-in "role rows" returned by GET /support/roles.
// None of these are ever persisted in role_definitions, so roleRepository.findById
// naturally returns null for them — assigning one to a user is rejected the same
// way an unknown role ID is.
export const BUILTIN_ROLE_DEFINITION_IDS = {
  ADMIN: 'role-builtin-admin',
  STAFF: 'role-builtin-staff',
  STUDENT: 'role-builtin-student',
  GUARDIAN: 'role-builtin-guardian',
  SYSTEM_ADMIN: 'role-builtin-system-admin',
  SUPPORT: 'role-builtin-support'
} as const;

// ADMIN's current effective access (see adminRoutes.ts pre-permission-catalog:
// schoolReadRoles + schoolManagementRoles + liveMonitorRoles all included ADMIN)
// is every catalog permission.
export const ADMIN_DEFAULT_PERMISSIONS: readonly PermissionKey[] = [...ALL_PERMISSION_KEYS];

// STAFF's current effective access was liveMonitorRoles only (schoolReadRoles and
// schoolManagementRoles both excluded STAFF) — preserve that exactly as the default.
export const STAFF_DEFAULT_PERMISSIONS: readonly PermissionKey[] = ['monitor.live'];

// SUPPORT's current effective access: read records, monitor live attendance,
// and manage a selected school's profile/branding, users, and devices. Not
// granted: school.data.manage (backup/restore/export/erase stays SYSTEM_ADMIN
// only) and school.submissions.manage (stays ADMIN + SYSTEM_ADMIN only).
export const SUPPORT_PERMISSIONS: readonly PermissionKey[] = [
  'school.records.read',
  'monitor.live',
  'school.profile.manage',
  'school.users.manage',
  'school.devices.manage'
];

const nowNever = null;

export const BUILTIN_ROLE_LIST_ITEMS: readonly RoleListItem[] = [
  {
    id: BUILTIN_ROLE_DEFINITION_IDS.ADMIN,
    name: 'Admin (built-in)',
    description: 'Full access within the school. Applies automatically when no custom role is assigned.',
    baseRole: 'ADMIN',
    permissions: [...ADMIN_DEFAULT_PERMISSIONS],
    isSystem: true,
    isActive: true,
    createdAt: nowNever,
    updatedAt: nowNever,
    assignable: false
  },
  {
    id: BUILTIN_ROLE_DEFINITION_IDS.STAFF,
    name: 'Staff (built-in)',
    description: 'Live attendance monitoring only. Applies automatically when no custom role is assigned.',
    baseRole: 'STAFF',
    permissions: [...STAFF_DEFAULT_PERMISSIONS],
    isSystem: true,
    isActive: true,
    createdAt: nowNever,
    updatedAt: nowNever,
    assignable: false
  },
  {
    id: BUILTIN_ROLE_DEFINITION_IDS.STUDENT,
    name: 'Student (built-in)',
    description: 'RFID card holder, attendance subject. Self-scoped attendance access only, not permission-catalog-based.',
    baseRole: 'STUDENT',
    permissions: [],
    isSystem: true,
    isActive: true,
    createdAt: nowNever,
    updatedAt: nowNever,
    assignable: false
  },
  {
    id: BUILTIN_ROLE_DEFINITION_IDS.GUARDIAN,
    name: 'Guardian (built-in)',
    description: 'Notification recipient, scoped to linked students. Self-scoped attendance access only, not permission-catalog-based.',
    baseRole: 'GUARDIAN',
    permissions: [],
    isSystem: true,
    isActive: true,
    createdAt: nowNever,
    updatedAt: nowNever,
    assignable: false
  },
  {
    id: BUILTIN_ROLE_DEFINITION_IDS.SYSTEM_ADMIN,
    name: 'System Admin (platform)',
    description: 'Platform administrator. Full access across every school, managed outside the role catalog.',
    baseRole: 'SYSTEM_ADMIN',
    permissions: [...ALL_PERMISSION_KEYS],
    isSystem: true,
    isActive: true,
    createdAt: nowNever,
    updatedAt: nowNever,
    assignable: false
  },
  {
    id: BUILTIN_ROLE_DEFINITION_IDS.SUPPORT,
    name: 'Support (platform)',
    description:
      'Cross-school support. Can manage a selected school\'s profile, users, and devices; ' +
      'school data management and submissions stay platform-admin/school-admin only. Managed outside the role catalog.',
    baseRole: 'SUPPORT',
    permissions: [...SUPPORT_PERMISSIONS],
    isSystem: true,
    isActive: true,
    createdAt: nowNever,
    updatedAt: nowNever,
    assignable: false
  }
];

/**
 * Resolves a user's effective permission set. If they carry an active,
 * base-role-matching custom RoleDefinition, its permissions are used as-is;
 * otherwise the built-in default for their base role applies. This is the
 * single source of truth requirePermission (and any in-controller permission
 * check) consults — nothing else should re-derive access from raw role lists.
 */
export const resolveUserPermissions = async (
  user: SessionUser,
  roleRepository: IRoleRepository
): Promise<PermissionKey[]> => {
  if (user.role === 'SYSTEM_ADMIN') {
    return [...ALL_PERMISSION_KEYS];
  }

  if (user.role === 'SUPPORT') {
    return [...SUPPORT_PERMISSIONS];
  }

  if (user.role === 'STUDENT' || user.role === 'GUARDIAN') {
    return [];
  }

  const baseRole = user.role;

  if (user.roleDefinitionId) {
    const definition = await roleRepository.findById(user.roleDefinitionId);

    if (definition && definition.isActive && definition.baseRole === baseRole) {
      return definition.permissions;
    }
  }

  return baseRole === 'ADMIN' ? [...ADMIN_DEFAULT_PERMISSIONS] : [...STAFF_DEFAULT_PERMISSIONS];
};
