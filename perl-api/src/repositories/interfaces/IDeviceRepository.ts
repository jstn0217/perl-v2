import type { PagedResult, PageQuery } from '../../types/Pagination.js';
import type { DeviceRecord } from '../../types/Device.js';

export interface DeviceListQuery extends PageQuery {
  status?: 'active' | 'inactive';
}

export interface IDeviceRepository {
  findDefaultBySchoolId(schoolId: string): Promise<DeviceRecord | null>;
  findById(deviceId: string): Promise<DeviceRecord | null>;
  findByKeyHash(keyHash: string): Promise<DeviceRecord | null>;
  listBySchool(schoolId: string): Promise<DeviceRecord[]>;
  listBySchoolPaged(schoolId: string, query: DeviceListQuery): Promise<PagedResult<DeviceRecord>>;
  create(device: DeviceRecord): Promise<DeviceRecord>;
  update(
    deviceId: string,
    schoolId: string,
    changes: Pick<DeviceRecord, 'keyHash' | 'keyLastFour' | 'isActive'>
  ): Promise<DeviceRecord | null>;
  deleteBySchool(schoolId: string): Promise<number>;
  touchLastSeen(deviceId: string): Promise<void>;
}
