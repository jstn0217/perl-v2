import type { PermissionKey } from '../../auth/permissionCatalog.js';
import type { RoleBaseRole, RoleDefinition } from '../../types/Role.js';

export interface CreateRoleDefinitionInput {
  id: string;
  name: string;
  description: string | null;
  baseRole: RoleBaseRole;
  permissions: PermissionKey[];
  createdAt: string;
  updatedAt: string;
}

export interface UpdateRoleDefinitionChanges {
  name?: string;
  description?: string | null;
  permissions?: PermissionKey[];
  isActive?: boolean;
  updatedAt: string;
}

export interface IRoleRepository {
  list(): Promise<RoleDefinition[]>;
  findById(id: string): Promise<RoleDefinition | null>;
  findByNameCaseInsensitive(name: string): Promise<RoleDefinition | null>;
  create(input: CreateRoleDefinitionInput): Promise<RoleDefinition>;
  update(id: string, changes: UpdateRoleDefinitionChanges): Promise<RoleDefinition | null>;
}
