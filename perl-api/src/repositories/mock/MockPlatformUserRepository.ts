import type { IPlatformUserRepository } from '../interfaces/IPlatformUserRepository.js';
import type { PlatformUserRecord } from '../../types/User.js';
import { createMockPlatformUsers } from './seeds.js';

let platformUsers: PlatformUserRecord[] = createMockPlatformUsers();

export const resetMockPlatformUsers = () => {
  platformUsers = createMockPlatformUsers();
};

export class MockPlatformUserRepository implements IPlatformUserRepository {
  async findByEmail(email: string): Promise<PlatformUserRecord | null> {
    return (
      platformUsers.find(
        (user) => user.email.toLowerCase() === email.toLowerCase() && user.isActive
      ) ?? null
    );
  }

  async findById(userId: string): Promise<PlatformUserRecord | null> {
    return platformUsers.find((user) => user.id === userId && user.isActive) ?? null;
  }

  async updateProfile(
    userId: string,
    changes: Partial<Pick<PlatformUserRecord, 'firstName' | 'lastName' | 'passwordHash'>>
  ): Promise<PlatformUserRecord | null> {
    const user = platformUsers.find((entry) => entry.id === userId);

    if (!user) {
      return null;
    }

    Object.assign(user, changes);

    return user;
  }
}
