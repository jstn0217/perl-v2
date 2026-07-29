import type { UserRecord } from '../../types/User.js';

export interface IUserRepository {
  findByEmail(email: string, options?: { includeInactive?: boolean }): Promise<UserRecord | null>;
  findByEmailAndSchool(
    email: string,
    schoolId: string,
    options?: { includeInactive?: boolean }
  ): Promise<UserRecord | null>;
  findById(userId: string): Promise<UserRecord | null>;
  findByCardUid(cardUid: string, options?: { includeInactive?: boolean }): Promise<UserRecord | null>;
  findStudentByCardUid(cardUid: string): Promise<UserRecord | null>;
  listBySchool(schoolId: string): Promise<UserRecord[]>;
  create(user: UserRecord): Promise<UserRecord>;
  update(userId: string, schoolId: string, changes: Partial<UserRecord>): Promise<UserRecord | null>;
  deactivate(userId: string, schoolId: string): Promise<UserRecord | null>;
  delete(userId: string, schoolId: string): Promise<boolean>;
  deleteBySchool(schoolId: string): Promise<number>;
  deleteBySchoolExcept(schoolId: string, userId: string): Promise<number>;
}
