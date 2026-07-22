import { env, type DataLayer } from '../config/env.js';
import { MockAttendanceRepository } from './mock/MockAttendanceRepository.js';
import { MockDeviceRepository } from './mock/MockDeviceRepository.js';
import { MockTenantRepository } from './mock/MockTenantRepository.js';
import { MockUserRepository } from './mock/MockUserRepository.js';
import type { IAttendanceRepository } from './interfaces/IAttendanceRepository.js';
import type { IDeviceRepository } from './interfaces/IDeviceRepository.js';
import type { ITenantRepository } from './interfaces/ITenantRepository.js';
import type { IUserRepository } from './interfaces/IUserRepository.js';

export interface RepositorySet {
  attendanceRepository: IAttendanceRepository;
  deviceRepository: IDeviceRepository;
  tenantRepository: ITenantRepository;
  userRepository: IUserRepository;
}

const createMockRepositories = (): RepositorySet => {
  return {
    attendanceRepository: new MockAttendanceRepository(),
    deviceRepository: new MockDeviceRepository(),
    tenantRepository: new MockTenantRepository(),
    userRepository: new MockUserRepository()
  };
};

export const createRepositories = (dataLayer: DataLayer = env.dataLayer): RepositorySet => {
  if (dataLayer === 'mock') {
    return createMockRepositories();
  }

  throw new Error('DATA_LAYER=db is reserved for Phase 6 and is not implemented yet.');
};
