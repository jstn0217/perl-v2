import type { DeviceRecord } from '../../types/Device.js';
import type { IDeviceRepository } from '../interfaces/IDeviceRepository.js';
import { createMockDevices } from './seeds.js';

let mockDevices: DeviceRecord[] = createMockDevices();

export const resetMockDevices = () => {
  mockDevices = createMockDevices();
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
}
