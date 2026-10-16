import type { PagedResult } from '../../types/Pagination.js';
import type { DeviceRecord } from '../../types/Device.js';
import type { DeviceListQuery, IDeviceRepository } from '../interfaces/IDeviceRepository.js';
import { createMockDevices } from './seeds.js';

let mockDevices: DeviceRecord[] = createMockDevices();

export const resetMockDevices = () => {
  mockDevices = createMockDevices();
};

// Production must not boot with the sample devices/keys baked into seeds.ts.
export const clearMockDevices = () => {
  mockDevices = [];
};

const compareDevicesByField = (
  field: string,
  a: { device: DeviceRecord; index: number },
  b: { device: DeviceRecord; index: number }
): number => {
  switch (field) {
    case 'location':
      return a.device.location.localeCompare(b.device.location);
    case 'status':
      return Number(a.device.isActive) - Number(b.device.isActive);
    case 'createdAt':
      // Mock array order reflects insertion/creation order; use it as a createdAt stand-in.
      return a.index - b.index;
    case 'name':
    default:
      return a.device.name.localeCompare(b.device.name);
  }
};

export class MockDeviceRepository implements IDeviceRepository {
  async findDefaultBySchoolId(schoolId: string): Promise<DeviceRecord | null> {
    return mockDevices.find((device) => device.schoolId === schoolId && device.isActive) ?? null;
  }

  async findById(deviceId: string): Promise<DeviceRecord | null> {
    return mockDevices.find((device) => device.id === deviceId) ?? null;
  }

  async findByKeyHash(keyHash: string): Promise<DeviceRecord | null> {
    return mockDevices.find((device) => device.keyHash === keyHash && device.isActive) ?? null;
  }

  async listBySchool(schoolId: string): Promise<DeviceRecord[]> {
    return mockDevices.filter((device) => device.schoolId === schoolId);
  }

  async listBySchoolPaged(schoolId: string, query: DeviceListQuery): Promise<PagedResult<DeviceRecord>> {
    const search = query.search?.trim().toLowerCase();

    const matches = mockDevices
      .map((device, index) => ({ device, index }))
      .filter(({ device }) => {
        if (device.schoolId !== schoolId) return false;
        if (query.status === 'active' && !device.isActive) return false;
        if (query.status === 'inactive' && device.isActive) return false;
        if (search) {
          const haystack = `${device.name} ${device.location} ${device.id} ${device.keyLastFour}`.toLowerCase();
          if (!haystack.includes(search)) return false;
        }
        return true;
      });

    const direction = query.dir === 'desc' ? -1 : 1;
    const sortField = query.sort ?? 'name';

    matches.sort((a, b) => {
      const compared = compareDevicesByField(sortField, a, b);
      if (compared !== 0) return compared * direction;
      return a.device.id.localeCompare(b.device.id);
    });

    const total = matches.length;
    const start = (query.page - 1) * query.pageSize;
    const items = matches.slice(start, start + query.pageSize).map(({ device }) => device);

    return { items, total };
  }

  async create(device: DeviceRecord): Promise<DeviceRecord> {
    if (mockDevices.some((entry) => entry.id === device.id || entry.keyHash === device.keyHash)) {
      throw new Error('A device with that ID or key already exists.');
    }

    mockDevices.push(device);

    return device;
  }

  async update(
    deviceId: string,
    schoolId: string,
    changes: Pick<DeviceRecord, 'keyHash' | 'keyLastFour' | 'isActive'>
  ): Promise<DeviceRecord | null> {
    const device = mockDevices.find((entry) => entry.id === deviceId && entry.schoolId === schoolId);

    if (!device) return null;
    if (mockDevices.some((entry) => entry.id !== deviceId && entry.keyHash === changes.keyHash)) {
      throw new Error('A device with that key already exists.');
    }

    Object.assign(device, changes);
    return device;
  }

  async deleteBySchool(schoolId: string): Promise<number> {
    const before = mockDevices.length;
    mockDevices = mockDevices.filter((device) => device.schoolId !== schoolId);
    return before - mockDevices.length;
  }

  async touchLastSeen(deviceId: string): Promise<void> {
    const device = mockDevices.find((entry) => entry.id === deviceId);
    if (device) {
      device.lastSeenAt = new Date().toISOString();
    }
  }
}
