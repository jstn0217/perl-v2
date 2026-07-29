import { env, type DataLayer } from '../config/env.js';
import { DbAuditRepository } from './db/DbAuditRepository.js';
import { DbAttendanceRepository } from './db/DbAttendanceRepository.js';
import { DbDeviceRepository } from './db/DbDeviceRepository.js';
import { closeDbPool } from './db/pool.js';
import { DbTenantRepository } from './db/DbTenantRepository.js';
import { initializeDatabase, resetAndSeedDatabase } from './db/schema.js';
import { DbUserRepository } from './db/DbUserRepository.js';
import { DbPlatformUserRepository } from './db/DbPlatformUserRepository.js';
import { DbNotificationRepository } from './db/DbNotificationRepository.js';
import { MockAttendanceRepository } from './mock/MockAttendanceRepository.js';
import { MockAuditRepository, resetMockAuditRecords } from './mock/MockAuditRepository.js';
import { MockDeviceRepository } from './mock/MockDeviceRepository.js';
import { resetMockAttendanceLogs } from './mock/MockAttendanceRepository.js';
import { MockTenantRepository } from './mock/MockTenantRepository.js';
import { resetMockSchools } from './mock/MockTenantRepository.js';
import { MockUserRepository } from './mock/MockUserRepository.js';
import { resetMockDevices } from './mock/MockDeviceRepository.js';
import { resetMockUsers } from './mock/MockUserRepository.js';
import {
  MockPlatformUserRepository,
  resetMockPlatformUsers
} from './mock/MockPlatformUserRepository.js';
import type { IAttendanceRepository } from './interfaces/IAttendanceRepository.js';
import type { IAuditRepository } from './interfaces/IAuditRepository.js';
import type { IDeviceRepository } from './interfaces/IDeviceRepository.js';
import type { ITenantRepository } from './interfaces/ITenantRepository.js';
import type { IUserRepository } from './interfaces/IUserRepository.js';
import type { IPlatformUserRepository } from './interfaces/IPlatformUserRepository.js';
import type { INotificationRepository } from './interfaces/INotificationRepository.js';
import {
  MockNotificationRepository,
  resetMockNotificationTransactions
} from './mock/MockNotificationRepository.js';

export interface RepositorySet {
  auditRepository: IAuditRepository;
  attendanceRepository: IAttendanceRepository;
  deviceRepository: IDeviceRepository;
  tenantRepository: ITenantRepository;
  userRepository: IUserRepository;
  platformUserRepository: IPlatformUserRepository;
  notificationRepository: INotificationRepository;
}

const createMockRepositories = (): RepositorySet => {
  return {
    auditRepository: new MockAuditRepository(),
    attendanceRepository: new MockAttendanceRepository(),
    deviceRepository: new MockDeviceRepository(),
    tenantRepository: new MockTenantRepository(),
    userRepository: new MockUserRepository(),
    platformUserRepository: new MockPlatformUserRepository(),
    notificationRepository: new MockNotificationRepository()
  };
};

const createDbRepositories = (): RepositorySet => {
  return {
    auditRepository: new DbAuditRepository(),
    attendanceRepository: new DbAttendanceRepository(),
    deviceRepository: new DbDeviceRepository(),
    tenantRepository: new DbTenantRepository(),
    userRepository: new DbUserRepository(),
    platformUserRepository: new DbPlatformUserRepository(),
    notificationRepository: new DbNotificationRepository()
  };
};

export const createRepositories = (dataLayer: DataLayer = env.dataLayer): RepositorySet => {
  if (dataLayer === 'mock') {
    return createMockRepositories();
  }

  return createDbRepositories();
};

export const initializeRepositoryLayer = async (dataLayer: DataLayer = env.dataLayer) => {
  if (dataLayer === 'db') {
    await initializeDatabase();
  }
};

export const resetRepositoriesForTests = async (dataLayer: DataLayer) => {
  if (dataLayer === 'mock') {
    resetMockAuditRecords();
    resetMockAttendanceLogs();
    resetMockDevices();
    resetMockSchools();
    resetMockUsers();
    resetMockPlatformUsers();
    resetMockNotificationTransactions();
    return;
  }

  await resetAndSeedDatabase();
};

export const closeRepositoryLayer = async (dataLayer: DataLayer) => {
  if (dataLayer === 'db') {
    await closeDbPool();
  }
};
