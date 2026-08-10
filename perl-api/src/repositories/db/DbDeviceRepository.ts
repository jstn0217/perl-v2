import type { DeviceListQuery, IDeviceRepository } from '../interfaces/IDeviceRepository.js';
import type { PagedResult } from '../../types/Pagination.js';
import type { DeviceRecord } from '../../types/Device.js';
import { mapDeviceRow, type DeviceRow } from './mappers.js';
import { getDbPool } from './pool.js';

const deviceOrderClause = (sort: string | undefined, dir: string | undefined) => {
  const direction = dir === 'desc' ? 'DESC' : 'ASC';

  switch (sort) {
    case 'location':
      return `location ${direction}, id ${direction}`;
    case 'status':
      return `is_active ${direction}, id ${direction}`;
    case 'createdAt':
      return `created_at ${direction}, id ${direction}`;
    case 'name':
    default:
      return `name ${direction}, id ${direction}`;
  }
};

export class DbDeviceRepository implements IDeviceRepository {
  async findDefaultBySchoolId(schoolId: string): Promise<DeviceRecord | null> {
    const { rows } = await getDbPool().query<DeviceRow>(
      `SELECT id, school_id, name, location, key_hash, key_last_four, is_active, last_seen_at
       FROM devices
       WHERE school_id = $1 AND is_active = TRUE
       ORDER BY created_at ASC, id ASC
       LIMIT 1`,
      [schoolId]
    );

    return rows[0] ? mapDeviceRow(rows[0]) : null;
  }

  async findById(deviceId: string): Promise<DeviceRecord | null> {
    const { rows } = await getDbPool().query<DeviceRow>(
      `SELECT id, school_id, name, location, key_hash, key_last_four, is_active, last_seen_at
       FROM devices
       WHERE id = $1
       LIMIT 1`,
      [deviceId]
    );

    return rows[0] ? mapDeviceRow(rows[0]) : null;
  }

  async findByKeyHash(keyHash: string): Promise<DeviceRecord | null> {
    const { rows } = await getDbPool().query<DeviceRow>(
      `SELECT id, school_id, name, location, key_hash, key_last_four, is_active, last_seen_at
       FROM devices
       WHERE key_hash = $1 AND is_active = TRUE
       LIMIT 1`,
      [keyHash]
    );

    return rows[0] ? mapDeviceRow(rows[0]) : null;
  }

  async listBySchool(schoolId: string): Promise<DeviceRecord[]> {
    const { rows } = await getDbPool().query<DeviceRow>(
      `SELECT id, school_id, name, location, key_hash, key_last_four, is_active, last_seen_at
       FROM devices
       WHERE school_id = $1
       ORDER BY created_at ASC, id ASC`,
      [schoolId]
    );

    return rows.map(mapDeviceRow);
  }

  async listBySchoolPaged(schoolId: string, query: DeviceListQuery): Promise<PagedResult<DeviceRecord>> {
    const conditions: string[] = ['school_id = $1'];
    const params: unknown[] = [schoolId];

    if (query.status === 'active') {
      conditions.push('is_active = TRUE');
    } else if (query.status === 'inactive') {
      conditions.push('is_active = FALSE');
    }

    const search = query.search?.trim();
    if (search) {
      params.push(`%${search}%`);
      const placeholder = `$${params.length}`;
      conditions.push(
        `(name ILIKE ${placeholder} OR location ILIKE ${placeholder}
          OR id ILIKE ${placeholder} OR key_last_four ILIKE ${placeholder})`
      );
    }

    const whereClause = conditions.join(' AND ');
    const orderClause = deviceOrderClause(query.sort, query.dir);
    const pool = getDbPool();

    const listParams = [...params, query.pageSize, (query.page - 1) * query.pageSize];
    const { rows } = await pool.query<DeviceRow>(
      `SELECT id, school_id, name, location, key_hash, key_last_four, is_active, last_seen_at
       FROM devices
       WHERE ${whereClause}
       ORDER BY ${orderClause}
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );

    const { rows: countRows } = await pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM devices WHERE ${whereClause}`,
      params
    );

    return { items: rows.map(mapDeviceRow), total: Number(countRows[0]?.total ?? 0) };
  }

  async create(device: DeviceRecord): Promise<DeviceRecord> {
    await getDbPool().query(
      `INSERT INTO devices (
        id, school_id, name, location, key_hash, key_last_four, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        device.id,
        device.schoolId,
        device.name,
        device.location,
        device.keyHash,
        device.keyLastFour,
        device.isActive
      ]
    );

    return device;
  }

  async update(
    deviceId: string,
    schoolId: string,
    changes: Pick<DeviceRecord, 'keyHash' | 'keyLastFour' | 'isActive'>
  ): Promise<DeviceRecord | null> {
    const result = await getDbPool().query(
      `UPDATE devices
       SET key_hash = $1, key_last_four = $2, is_active = $3
       WHERE id = $4 AND school_id = $5`,
      [changes.keyHash, changes.keyLastFour, changes.isActive, deviceId, schoolId]
    );

    return (result.rowCount ?? 0) > 0 ? this.findById(deviceId) : null;
  }

  async deleteBySchool(schoolId: string): Promise<number> {
    const result = await getDbPool().query(
      'DELETE FROM devices WHERE school_id = $1',
      [schoolId]
    );
    return result.rowCount ?? 0;
  }

  async touchLastSeen(deviceId: string): Promise<void> {
    await getDbPool().query('UPDATE devices SET last_seen_at = NOW() WHERE id = $1', [deviceId]);
  }
}
