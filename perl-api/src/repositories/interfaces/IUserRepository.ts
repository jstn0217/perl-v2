import type { UserRecord } from '../../types/User.js';

export interface IUserRepository {
  findByEmailAndSchool(email: string, schoolId: string): Promise<UserRecord | null>;
  findById(userId: string): Promise<UserRecord | null>;
}
