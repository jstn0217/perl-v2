import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { IDeviceRepository } from '../interfaces/IDeviceRepository.js';
import type { DeviceRecord } from '../../types/Device.js';
import { mapDeviceRow, type DeviceRow } from './mappers.js';
import { getDbPool } from './pool.js';

export class DbDeviceRepository implements IDeviceRepository {
  async findDefaultBySchoolId(schoolId: string): Promise<DeviceRecord | null> {
    const [rows] = await getDbPool().query<(DeviceRow & RowDataPacket)[]>(
      `SELECT id, school_id, name, location, key_hash, key_last_four, is_active
       FROM devices
       WHERE school_id = ? AND is_active = 1
       ORDER BY created_at ASC, id ASC
       LIMIT 1`,
      [schoolId]
    );

    return rows[0] ? mapDeviceRow(rows[0]) : null;
  }

  async findById(deviceId: string): Promise<DeviceRecord | null> {
    const [rows] = await getDbPool().query<(DeviceRow & RowDataPacket)[]>(
      `SELECT id, school_id, name, location, key_hash, key_last_four, is_active
       FROM devices
       WHERE id = ?
       LIMIT 1`,
      [deviceId]
    );

    return rows[0] ? mapDeviceRow(rows[0]) : null;
  }

  async findByKeyHash(keyHash: string): Promise<DeviceRecord | null> {
    const [rows] = await getDbPool().query<(DeviceRow & RowDataPacket)[]>(
      `SELECT id, school_id, name, location, key_hash, key_last_four, is_active
       FROM devices
       WHERE key_hash = ? AND is_active = 1
       LIMIT 1`,
      [keyHash]
    );

    return rows[0] ? mapDeviceRow(rows[0]) : null;
  }

  async listBySchool(schoolId: string): Promise<DeviceRecord[]> {
    const [rows] = await getDbPool().query<(DeviceRow & RowDataPacket)[]>(
      `SELECT id, school_id, name, location, key_hash, key_last_four, is_active
       FROM devices
       WHERE school_id = ?
       ORDER BY created_at ASC, id ASC`,
      [schoolId]
    );

    return rows.map(mapDeviceRow);
  }

  async create(device: DeviceRecord): Promise<DeviceRecord> {
    await getDbPool().query(
      `INSERT INTO devices (
        id, school_id, name, location, key_hash, key_last_four, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        device.id,
        device.schoolId,
        device.name,
        device.location,
        device.keyHash,
        device.keyLastFour,
        device.isActive ? 1 : 0
      ]
    );

    return device;
  }

  async update(
    deviceId: string,
    schoolId: string,
    changes: Pick<DeviceRecord, 'keyHash' | 'keyLastFour' | 'isActive'>
  ): Promise<DeviceRecord | null> {
    const [result] = await getDbPool().query<ResultSetHeader>(
      `UPDATE devices
       SET key_hash = ?, key_last_four = ?, is_active = ?
       WHERE id = ? AND school_id = ?`,
      [changes.keyHash, changes.keyLastFour, changes.isActive ? 1 : 0, deviceId, schoolId]
    );

    return (result.affectedRows ?? 0) > 0 ? this.findById(deviceId) : null;
  }

  async deleteBySchool(schoolId: string): Promise<number> {
    const [result] = await getDbPool().query<ResultSetHeader>(
      'DELETE FROM devices WHERE school_id = ?',
      [schoolId]
    );
    return result.affectedRows ?? 0;
  }
}
