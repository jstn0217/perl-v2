import { randomUUID } from 'node:crypto';
import { isPermissionKey, type PermissionKey } from '../auth/permissionCatalog.js';
import { BUILTIN_ROLE_DEFINITION_IDS, BUILTIN_ROLE_LIST_ITEMS } from '../auth/rolePermissions.js';
import type { IRoleRepository, UpdateRoleDefinitionChanges } from '../repositories/interfaces/IRoleRepository.js';
import type { IUserRepository } from '../repositories/interfaces/IUserRepository.js';
import type { RoleBaseRole, RoleDefinition, RoleListItem } from '../types/Role.js';
import { DomainError } from '../utils/errors.js';

export interface CreateRoleInput {
  name?: unknown;
  description?: unknown;
  baseRole?: unknown;
  permissions?: unknown;
}

export interface UpdateRoleInput {
  name?: unknown;
  description?: unknown;
  permissions?: unknown;
}

const validBaseRoles: RoleBaseRole[] = ['ADMIN', 'STAFF'];

const normalizeRequiredString = (value: unknown, field: string): string => {
  const normalized = typeof value === 'string' ? value.trim() : '';

  if (!normalized) {
    throw new DomainError(`${field} is required.`);
  }

  return normalized;
};

const normalizeOptionalString = (value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new DomainError('description must be a string.');
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const assertBaseRole = (value: unknown): RoleBaseRole => {
  if (typeof value !== 'string' || !validBaseRoles.includes(value as RoleBaseRole)) {
    throw new DomainError('baseRole must be one of: ADMIN, STAFF.');
  }

  return value as RoleBaseRole;
};

const assertPermissions = (value: unknown): PermissionKey[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new DomainError('permissions must be a non-empty array of valid permission keys.');
  }

  const unique = [...new Set(value)];

  if (!unique.every(isPermissionKey)) {
    throw new DomainError('permissions must be a non-empty array of valid permission keys.');
  }

  return unique;
};

const toListItem = (role: RoleDefinition): RoleListItem => ({
  ...role,
  assignable: true
});

export class RoleService {
  constructor(
    private readonly roleRepository: IRoleRepository,
    private readonly userRepository: IUserRepository
  ) {}

  async list(): Promise<RoleListItem[]> {
    const custom = await this.roleRepository.list();
    return [...BUILTIN_ROLE_LIST_ITEMS, ...custom.map(toListItem)];
  }

  async create(input: CreateRoleInput): Promise<RoleDefinition> {
    const name = normalizeRequiredString(input.name, 'Role name');
    const baseRole = assertBaseRole(input.baseRole);
    const permissions = assertPermissions(input.permissions);

    await this.assertNameUnique(name);

    const now = new Date().toISOString();

    return this.roleRepository.create({
      id: `role-${randomUUID()}`,
      name,
      description: normalizeOptionalString(input.description),
      baseRole,
      permissions,
      createdAt: now,
      updatedAt: now
    });
  }

  async update(id: string, input: UpdateRoleInput): Promise<RoleDefinition> {
    this.assertNotBuiltin(id);
    const existing = await this.requireRole(id);
    const changes: UpdateRoleDefinitionChanges = { updatedAt: new Date().toISOString() };

    if (input.name !== undefined) {
      const name = normalizeRequiredString(input.name, 'Role name');
      if (name.toLowerCase() !== existing.name.toLowerCase()) {
        await this.assertNameUnique(name);
      }
      changes.name = name;
    }

    if (input.description !== undefined) {
      changes.description = normalizeOptionalString(input.description);
    }

    if (input.permissions !== undefined) {
      changes.permissions = assertPermissions(input.permissions);
    }

    const updated = await this.roleRepository.update(id, changes);

    if (!updated) {
      throw new DomainError('Role not found.', 404);
    }

    return updated;
  }

  async deactivate(id: string): Promise<RoleDefinition> {
    this.assertNotBuiltin(id);
    const existing = await this.requireRole(id);

    if (!existing.isActive) {
      return existing;
    }

    // Deactivation is blocked while any user is still assigned to this role,
    // rather than letting them silently fall back to base-role permission
    // defaults. An unnoticed permission change is a worse failure mode than a
    // blocked deactivation the admin must resolve explicitly by reassigning
    // or deactivating those users first.
    const assignedCount = await this.userRepository.countByRoleDefinitionId(id);

    if (assignedCount > 0) {
      throw new DomainError(
        `Cannot deactivate: ${assignedCount} user(s) are currently assigned to this role.`
      );
    }

    const updated = await this.roleRepository.update(id, {
      isActive: false,
      updatedAt: new Date().toISOString()
    });

    if (!updated) {
      throw new DomainError('Role not found.', 404);
    }

    return updated;
  }

  async reactivate(id: string): Promise<RoleDefinition> {
    this.assertNotBuiltin(id);
    const existing = await this.requireRole(id);

    if (existing.isActive) {
      return existing;
    }

    const updated = await this.roleRepository.update(id, {
      isActive: true,
      updatedAt: new Date().toISOString()
    });

    if (!updated) {
      throw new DomainError('Role not found.', 404);
    }

    return updated;
  }

  private assertNotBuiltin(id: string): void {
    if ((Object.values(BUILTIN_ROLE_DEFINITION_IDS) as string[]).includes(id)) {
      throw new DomainError('Built-in roles cannot be modified.');
    }
  }

  private async requireRole(id: string): Promise<RoleDefinition> {
    const role = await this.roleRepository.findById(id);

    if (!role) {
      throw new DomainError('Role not found.', 404);
    }

    return role;
  }

  private async assertNameUnique(name: string): Promise<void> {
    const existing = await this.roleRepository.findByNameCaseInsensitive(name);

    if (existing) {
      throw new DomainError('A role with that name already exists.');
    }
  }
}
