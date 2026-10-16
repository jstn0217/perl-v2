import type {
  CreateRoleDefinitionInput,
  IRoleRepository,
  UpdateRoleDefinitionChanges
} from '../interfaces/IRoleRepository.js';
import type { RoleDefinition } from '../../types/Role.js';
import { mapRoleDefinitionRow, type RoleDefinitionRow } from './mappers.js';
import { getDbPool } from './pool.js';

const roleColumns = 'id, name, description, base_role, permissions, is_active, created_at, updated_at';

export class DbRoleRepository implements IRoleRepository {
  async list(): Promise<RoleDefinition[]> {
    const { rows } = await getDbPool().query<RoleDefinitionRow>(
      `SELECT ${roleColumns} FROM role_definitions ORDER BY created_at ASC, id ASC`
    );
    return rows.map(mapRoleDefinitionRow);
  }

  async findById(id: string): Promise<RoleDefinition | null> {
    const { rows } = await getDbPool().query<RoleDefinitionRow>(
      `SELECT ${roleColumns} FROM role_definitions WHERE id = $1 LIMIT 1`,
      [id]
    );
    return rows[0] ? mapRoleDefinitionRow(rows[0]) : null;
  }

  async findByNameCaseInsensitive(name: string): Promise<RoleDefinition | null> {
    const { rows } = await getDbPool().query<RoleDefinitionRow>(
      `SELECT ${roleColumns} FROM role_definitions WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      [name]
    );
    return rows[0] ? mapRoleDefinitionRow(rows[0]) : null;
  }

  async create(input: CreateRoleDefinitionInput): Promise<RoleDefinition> {
    const { rows } = await getDbPool().query<RoleDefinitionRow>(
      `INSERT INTO role_definitions (id, name, description, base_role, permissions, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7)
       RETURNING ${roleColumns}`,
      [
        input.id,
        input.name,
        input.description,
        input.baseRole,
        JSON.stringify(input.permissions),
        input.createdAt,
        input.updatedAt
      ]
    );

    return mapRoleDefinitionRow(rows[0]);
  }

  async update(id: string, changes: UpdateRoleDefinitionChanges): Promise<RoleDefinition | null> {
    const existing = await this.findById(id);

    if (!existing) {
      return null;
    }

    const next = {
      name: changes.name ?? existing.name,
      description: changes.description !== undefined ? changes.description : existing.description,
      permissions: changes.permissions ?? existing.permissions,
      isActive: changes.isActive ?? existing.isActive
    };

    await getDbPool().query(
      `UPDATE role_definitions
       SET name = $1, description = $2, permissions = $3, is_active = $4, updated_at = $5
       WHERE id = $6`,
      [next.name, next.description, JSON.stringify(next.permissions), next.isActive, changes.updatedAt, id]
    );

    return this.findById(id);
  }
}
