import type { RowDataPacket } from 'mysql2';
import type { IPlatformUserRepository } from '../interfaces/IPlatformUserRepository.js';
import type { PlatformUserRecord, PlatformUserRole } from '../../types/User.js';
import { getDbPool } from './pool.js';

interface PlatformUserRow extends RowDataPacket {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: PlatformUserRole;
  is_active: number;
}

const mapPlatformUser = (row: PlatformUserRow): PlatformUserRecord => ({
  id: row.id,
  email: row.email,
  passwordHash: row.password_hash,
  firstName: row.first_name,
  lastName: row.last_name,
  role: row.role,
  isActive: Boolean(row.is_active)
});

export class DbPlatformUserRepository implements IPlatformUserRepository {
  async findByEmail(email: string): Promise<PlatformUserRecord | null> {
    const [rows] = await getDbPool().query<PlatformUserRow[]>(
      `SELECT id, email, password_hash, first_name, last_name, role, is_active
       FROM platform_users
       WHERE email = ? AND is_active = 1
       LIMIT 1`,
      [email.toLowerCase()]
    );

    return rows[0] ? mapPlatformUser(rows[0]) : null;
  }

  async findById(userId: string): Promise<PlatformUserRecord | null> {
    const [rows] = await getDbPool().query<PlatformUserRow[]>(
      `SELECT id, email, password_hash, first_name, last_name, role, is_active
       FROM platform_users
       WHERE id = ? AND is_active = 1
       LIMIT 1`,
      [userId]
    );

    return rows[0] ? mapPlatformUser(rows[0]) : null;
  }
}
