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
import { DbSubmissionRepository } from './db/DbSubmissionRepository.js';
import { MockAttendanceRepository } from './mock/MockAttendanceRepository.js';
import { MockAuditRepository, resetMockAuditRecords } from './mock/MockAuditRepository.js';
import { MockDeviceRepository } from './mock/MockDeviceRepository.js';
import { resetMockAttendanceLogs } from './mock/MockAttendanceRepository.js';
import { MockTenantRepository } from './mock/MockTenantRepository.js';
import { resetMockSchools, clearMockSchools } from './mock/MockTenantRepository.js';
import { MockUserRepository } from './mock/MockUserRepository.js';
import { MockSubmissionRepository, resetMockSubmissions } from './mock/MockSubmissionRepository.js';
import { MockRoleRepository, resetMockRoleDefinitions } from './mock/MockRoleRepository.js';
import { DbRoleRepository } from './db/DbRoleRepository.js';
import { resetMockDevices, clearMockDevices } from './mock/MockDeviceRepository.js';
import { resetMockUsers, clearMockUsers } from './mock/MockUserRepository.js';
import { seedDemoTenant } from './seedDemoTenant.js';
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
import type { IRoleRepository } from './interfaces/IRoleRepository.js';
import type { INotificationRepository } from './interfaces/INotificationRepository.js';
import type { ISubmissionRepository } from './interfaces/ISubmissionRepository.js';
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
  roleRepository: IRoleRepository;
  submissionRepository: ISubmissionRepository;
}

const createMockRepositories = (): RepositorySet => {
  return {
    auditRepository: new MockAuditRepository(),
    attendanceRepository: new MockAttendanceRepository(),
    deviceRepository: new MockDeviceRepository(),
    tenantRepository: new MockTenantRepository(),
    userRepository: new MockUserRepository(),
    platformUserRepository: new MockPlatformUserRepository(),
    notificationRepository: new MockNotificationRepository(),
    roleRepository: new MockRoleRepository(),
    submissionRepository: new MockSubmissionRepository()
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
    notificationRepository: new DbNotificationRepository(),
    roleRepository: new DbRoleRepository(),
    submissionRepository: new DbSubmissionRepository()
  };
};

export const createRepositories = (dataLayer: DataLayer = env.dataLayer): RepositorySet => {
  if (dataLayer === 'mock') {
    return createMockRepositories();
  }

  return createDbRepositories();
};

const isSampleSeedEnvironment = () =>
  env.nodeEnvironment === 'development' || env.nodeEnvironment === 'test';

export const initializeRepositoryLayer = async (dataLayer: DataLayer = env.dataLayer) => {
  if (dataLayer === 'db') {
    await initializeDatabase();
    return;
  }

  // Mock repositories seed the public sample schools/users/devices (seeds.ts) at module
  // load, regardless of environment. Clear them outside development/test so a mock-layer
  // production boot never exposes those sample credentials.
  if (!isSampleSeedEnvironment()) {
    clearMockSchools();
    clearMockUsers();
    clearMockDevices();
  }

  if (env.demoTenant.seedEnabled) {
    await seedDemoTenant(new MockTenantRepository(), new MockUserRepository(), {
      schoolName: env.demoTenant.schoolName,
      schoolSlug: env.demoTenant.schoolSlug,
      adminEmail: env.demoTenant.adminEmail,
      adminPassword: env.demoTenant.adminPassword
    });
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
    resetMockRoleDefinitions();
    resetMockSubmissions();
    return;
  }

  await resetAndSeedDatabase();
};

export const closeRepositoryLayer = async (dataLayer: DataLayer) => {
  if (dataLayer === 'db') {
    await closeDbPool();
  }
};
