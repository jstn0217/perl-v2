import type { PermissionKey } from '../auth/permissionCatalog.js';
import type { UserRole } from './User.js';

// Custom role definitions are only ever assignable to school users whose base
// role is ADMIN or STAFF. STUDENT/GUARDIAN have no permission surface, and
// SYSTEM_ADMIN/SUPPORT are platform roles managed outside this table entirely.
export type RoleBaseRole = 'ADMIN' | 'STAFF';

// A persisted, admin-editable role definition. Built-in roles (ADMIN, STAFF,
// STUDENT, GUARDIAN, SYSTEM_ADMIN, SUPPORT) are never rows in this shape —
// they are served as virtual RoleListItem entries computed from code so they
// can never drift or be edited via the API.
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

// Response shape for GET /support/roles: persisted custom roles plus the
// virtual built-in rows, so a management UI can render one unified list.
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
  // False for virtual built-in rows: they are never a valid roleDefinitionId
  // to assign to a user, since base-role defaults already apply when unset.
  assignable: boolean;
}
