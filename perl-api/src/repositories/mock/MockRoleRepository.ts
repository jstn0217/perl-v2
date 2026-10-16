import type {
  CreateRoleDefinitionInput,
  IRoleRepository,
  UpdateRoleDefinitionChanges
} from '../interfaces/IRoleRepository.js';
import type { RoleDefinition } from '../../types/Role.js';

let roleDefinitions: RoleDefinition[] = [];

export const resetMockRoleDefinitions = () => {
  roleDefinitions = [];
};

export class MockRoleRepository implements IRoleRepository {
  async list(): Promise<RoleDefinition[]> {
    return [...roleDefinitions];
  }

  async findById(id: string): Promise<RoleDefinition | null> {
    return roleDefinitions.find((role) => role.id === id) ?? null;
  }

  async findByNameCaseInsensitive(name: string): Promise<RoleDefinition | null> {
    return roleDefinitions.find((role) => role.name.toLowerCase() === name.toLowerCase()) ?? null;
  }

  async create(input: CreateRoleDefinitionInput): Promise<RoleDefinition> {
    const role: RoleDefinition = {
      id: input.id,
      name: input.name,
      description: input.description,
      baseRole: input.baseRole,
      permissions: input.permissions,
      isSystem: false,
      isActive: true,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt
    };

    roleDefinitions.push(role);

    return role;
  }

  async update(id: string, changes: UpdateRoleDefinitionChanges): Promise<RoleDefinition | null> {
    const role = roleDefinitions.find((entry) => entry.id === id);

    if (!role) {
      return null;
    }

    if (changes.name !== undefined) role.name = changes.name;
    if (changes.description !== undefined) role.description = changes.description;
    if (changes.permissions !== undefined) role.permissions = changes.permissions;
    if (changes.isActive !== undefined) role.isActive = changes.isActive;
    role.updatedAt = changes.updatedAt;

    return role;
  }
}
