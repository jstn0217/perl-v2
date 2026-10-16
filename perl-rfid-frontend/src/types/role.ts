import type { UserRole } from './admin';

// Mirrors perl-api/src/auth/permissionCatalog.ts. Kept as a plain string type
// (not a generated union) since the two packages don't share types — see the
// existing mirroring convention in src/types/school.ts and src/types/admin.ts.
export type PermissionKey =
  | 'school.records.read'
  | 'school.profile.manage'
  | 'school.users.manage'
  | 'school.devices.manage'
  | 'school.data.manage'
  | 'monitor.live';

export interface PermissionCatalogEntry {
  key: PermissionKey;
  label: string;
  group: string;
}

// Custom role definitions are only ever assignable to ADMIN/STAFF school
// users. STUDENT/GUARDIAN have no permission surface, and SYSTEM_ADMIN/SUPPORT
// are platform roles managed outside this table entirely.
export type RoleBaseRole = 'ADMIN' | 'STAFF';

// Response shape for GET /support/roles: persisted custom roles plus virtual
// built-in rows, rendered as one unified list.
export interface RoleListItem {
  id: string;
  name: string;
  description: string | null;
  baseRole: UserRole;
  permissions: PermissionKey[];
  isSystem: boolean;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  // False for virtual built-in rows: never a valid roleDefinitionId to assign.
  assignable: boolean;
}

export interface RoleDefinition {
  id: string;
  name: string;
  description: string | null;
  baseRole: RoleBaseRole;
  permissions: PermissionKey[];
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRolePayload {
  name: string;
  description?: string | null;
  baseRole: RoleBaseRole;
  permissions: PermissionKey[];
}

export interface UpdateRolePayload {
  name?: string;
  description?: string | null;
  permissions?: PermissionKey[];
}

// GET /admin/schools/:schoolId/assignable-roles item shape.
export interface AssignableRole {
  id: string;
  name: string;
  description: string | null;
  baseRole: RoleBaseRole;
  permissions: PermissionKey[];
}
