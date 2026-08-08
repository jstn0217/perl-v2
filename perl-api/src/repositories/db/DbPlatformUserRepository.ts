import type { IPlatformUserRepository } from '../interfaces/IPlatformUserRepository.js';
import type { PlatformUserRecord, PlatformUserRole } from '../../types/User.js';
import { getDbPool } from './pool.js';

interface PlatformUserRow {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: PlatformUserRole;
  is_active: boolean;
}

const mapPlatformUser = (row: PlatformUserRow): PlatformUserRecord => ({
  id: row.id,
  email: row.email,
  passwordHash: row.password_hash,
  firstName: row.first_name,
  lastName: row.last_name,
  role: row.role,
  isActive: row.is_active
});

export class DbPlatformUserRepository implements IPlatformUserRepository {
  async findByEmail(email: string): Promise<PlatformUserRecord | null> {
    const { rows } = await getDbPool().query<PlatformUserRow>(
      `SELECT id, email, password_hash, first_name, last_name, role, is_active
       FROM platform_users
       WHERE email = $1 AND is_active = TRUE
       LIMIT 1`,
      [email.toLowerCase()]
    );

    return rows[0] ? mapPlatformUser(rows[0]) : null;
  }

  async findById(userId: string): Promise<PlatformUserRecord | null> {
    const { rows } = await getDbPool().query<PlatformUserRow>(
      `SELECT id, email, password_hash, first_name, last_name, role, is_active
       FROM platform_users
       WHERE id = $1 AND is_active = TRUE
       LIMIT 1`,
      [userId]
    );

    return rows[0] ? mapPlatformUser(rows[0]) : null;
  }

  async updateProfile(
    userId: string,
    changes: Partial<Pick<PlatformUserRecord, 'firstName' | 'lastName' | 'passwordHash'>>
  ): Promise<PlatformUserRecord | null> {
    const existing = await this.findById(userId);

    if (!existing) {
      return null;
    }

    const next = {
      firstName: changes.firstName ?? existing.firstName,
      lastName: changes.lastName ?? existing.lastName,
      passwordHash: changes.passwordHash ?? existing.passwordHash
    };

    await getDbPool().query(
      `UPDATE platform_users
       SET first_name = $1, last_name = $2, password_hash = $3
       WHERE id = $4`,
      [next.firstName, next.lastName, next.passwordHash, userId]
    );

    return this.findById(userId);
  }
}
