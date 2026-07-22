import type { IDeviceRepository } from '../interfaces/IDeviceRepository.js';

export class MockDeviceRepository implements IDeviceRepository {
  async listDeviceIds(): Promise<string[]> {
    return [];
  }
}
