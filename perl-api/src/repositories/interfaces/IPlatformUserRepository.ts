import type { PlatformUserRecord } from '../../types/User.js';

export interface IPlatformUserRepository {
  findByEmail(email: string): Promise<PlatformUserRecord | null>;
  findById(userId: string): Promise<PlatformUserRecord | null>;
}
