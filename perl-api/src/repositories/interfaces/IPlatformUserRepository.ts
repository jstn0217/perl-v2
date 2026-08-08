import type { PlatformUserRecord } from '../../types/User.js';

export interface IPlatformUserRepository {
  findByEmail(email: string): Promise<PlatformUserRecord | null>;
  findById(userId: string): Promise<PlatformUserRecord | null>;
  updateProfile(
    userId: string,
    changes: Partial<Pick<PlatformUserRecord, 'firstName' | 'lastName' | 'passwordHash'>>
  ): Promise<PlatformUserRecord | null>;
}
