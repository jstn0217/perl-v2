import { createHash, randomBytes } from 'node:crypto';
import type { DeviceListQuery, IDeviceRepository } from '../repositories/interfaces/IDeviceRepository.js';
import type { PagedResult } from '../types/Pagination.js';
import type { DeviceRecord, DeviceView } from '../types/Device.js';

export interface RegisteredDevice {
  device: DeviceView;
  deviceKey: string;
}

export class DeviceService {
  constructor(private readonly deviceRepository: IDeviceRepository) {}

  async listDevices(schoolId: string): Promise<DeviceView[]> {
    const devices = await this.deviceRepository.listBySchool(schoolId);

    return devices.map((device) => this.toDeviceView(device));
  }

  async listDevicesPaged(schoolId: string, query: DeviceListQuery): Promise<PagedResult<DeviceView>> {
    const { items, total } = await this.deviceRepository.listBySchoolPaged(schoolId, query);

    return { items: items.map((device) => this.toDeviceView(device)), total };
  }

  async registerDevice(schoolId: string, name?: string, location?: string): Promise<RegisteredDevice> {
    const normalizedName = name?.trim();
    const normalizedLocation = location?.trim();

    if (!normalizedName) {
      throw new Error('Device name is required.');
    }

    if (!normalizedLocation) {
      throw new Error('Device location is required.');
    }

    const deviceKey = randomBytes(24).toString('hex');
    const device: DeviceRecord = {
      id: `device-${schoolId}-${Date.now()}`,
      schoolId,
      name: normalizedName,
      location: normalizedLocation,
      keyHash: hashDeviceKey(deviceKey),
      keyLastFour: deviceKey.slice(-4),
      isActive: true
    };

    const created = await this.deviceRepository.create(device);

    return {
      device: this.toDeviceView(created),
      deviceKey
    };
  }

  async authenticateDeviceKey(deviceKey: string): Promise<DeviceRecord> {
    const normalizedKey = deviceKey.trim();

    if (!normalizedKey) {
      throw new Error('Device key is required.');
    }

    const device = await this.deviceRepository.findByKeyHash(hashDeviceKey(normalizedKey));

    if (!device) {
      throw new Error('Invalid device key.');
    }

    return device;
  }

  async rotateDeviceKey(schoolId: string, deviceId: string): Promise<RegisteredDevice> {
    const existing = await this.requireSchoolDevice(schoolId, deviceId);

    if (!existing.isActive) {
      throw new Error('Inactive devices cannot rotate keys.');
    }

    const deviceKey = randomBytes(24).toString('hex');
    const updated = await this.deviceRepository.update(deviceId, schoolId, {
      keyHash: hashDeviceKey(deviceKey),
      keyLastFour: deviceKey.slice(-4),
      isActive: true
    });

    if (!updated) throw new Error('Device not found.');

    return { device: this.toDeviceView(updated), deviceKey };
  }

  async deactivateDevice(schoolId: string, deviceId: string): Promise<DeviceView> {
    const existing = await this.requireSchoolDevice(schoolId, deviceId);
    const updated = await this.deviceRepository.update(deviceId, schoolId, {
      keyHash: existing.keyHash,
      keyLastFour: existing.keyLastFour,
      isActive: false
    });

    if (!updated) throw new Error('Device not found.');

    return this.toDeviceView(updated);
  }

  private async requireSchoolDevice(schoolId: string, deviceId: string): Promise<DeviceRecord> {
    const device = await this.deviceRepository.findById(deviceId);

    if (!device || device.schoolId !== schoolId) {
      throw new Error('Device not found.');
    }

    return device;
  }

  private toDeviceView(device: DeviceRecord): DeviceView {
    return {
      id: device.id,
      schoolId: device.schoolId,
      name: device.name,
      location: device.location,
      keyLastFour: device.keyLastFour,
      isActive: device.isActive
    };
  }
}

export const hashDeviceKey = (deviceKey: string) => {
  return createHash('sha256').update(deviceKey).digest('hex');
};
