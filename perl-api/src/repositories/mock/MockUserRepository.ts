import type { UserRecord } from '../../types/User.js';
import type { IUserRepository } from '../interfaces/IUserRepository.js';
import { createMockUsers } from './seeds.js';

let mockUsers: UserRecord[] = createMockUsers();

export const resetMockUsers = () => {
  mockUsers = createMockUsers();
};

export class MockUserRepository implements IUserRepository {
  async findByEmail(
    email: string,
    options?: { includeInactive?: boolean }
  ): Promise<UserRecord | null> {
    const matches = mockUsers.filter(
      (user) =>
        user.email.toLowerCase() === email.toLowerCase() &&
        (options?.includeInactive ? true : user.isActive)
    );

    if (matches.length > 1) {
      throw new Error('Multiple school accounts use this email. Contact system support.');
    }

    return matches[0] ?? null;
  }

  async findByEmailAndSchool(
    email: string,
    schoolId: string,
    options?: { includeInactive?: boolean }
  ): Promise<UserRecord | null> {
    return (
      mockUsers.find(
        (user) =>
          user.email.toLowerCase() === email.toLowerCase() &&
          user.schoolId === schoolId &&
          (options?.includeInactive ? true : user.isActive)
      ) ?? null
    );
  }

  async findById(userId: string): Promise<UserRecord | null> {
    return mockUsers.find((user) => user.id === userId) ?? null;
  }

  async findByCardUid(cardUid: string, options?: { includeInactive?: boolean }): Promise<UserRecord | null> {
    return (
      mockUsers.find(
        (user) => user.cardUid === cardUid && (options?.includeInactive ? true : user.isActive)
      ) ?? null
    );
  }

  async findStudentByCardUid(cardUid: string): Promise<UserRecord | null> {
    return (
      mockUsers.find((user) => user.role === 'STUDENT' && user.cardUid === cardUid && user.isActive) ?? null
    );
  }

  async listBySchool(schoolId: string): Promise<UserRecord[]> {
    return mockUsers.filter((user) => user.schoolId === schoolId);
  }

  async create(user: UserRecord): Promise<UserRecord> {
    if (mockUsers.some((entry) => entry.id === user.id)) {
      throw new Error('A user with that ID already exists.');
    }

    if (
      mockUsers.some(
        (entry) => entry.email.toLowerCase() === user.email.toLowerCase()
      )
    ) {
      throw new Error('A user with that email already exists.');
    }

    if (user.cardUid && mockUsers.some((entry) => entry.cardUid === user.cardUid)) {
      throw new Error('A user with that card UID already exists.');
    }

    mockUsers.push(user);

    return user;
  }

  async update(userId: string, schoolId: string, changes: Partial<UserRecord>): Promise<UserRecord | null> {
    const user = mockUsers.find((entry) => entry.id === userId && entry.schoolId === schoolId);

    if (!user) {
      return null;
    }

    Object.assign(user, changes);

    return user;
  }

  async deactivate(userId: string, schoolId: string): Promise<UserRecord | null> {
    const user = mockUsers.find((entry) => entry.id === userId && entry.schoolId === schoolId);

    if (!user) {
      return null;
    }

    user.isActive = false;

    return user;
  }

  async delete(userId: string, schoolId: string): Promise<boolean> {
    const before = mockUsers.length;
    mockUsers = mockUsers.filter((user) => user.id !== userId || user.schoolId !== schoolId);
    return mockUsers.length < before;
  }

  async deleteBySchool(schoolId: string): Promise<number> {
    const before = mockUsers.length;
    mockUsers = mockUsers.filter((user) => user.schoolId !== schoolId);
    return before - mockUsers.length;
  }

  async deleteBySchoolExcept(schoolId: string, userId: string): Promise<number> {
    const before = mockUsers.length;
    mockUsers = mockUsers.filter((user) => user.schoolId !== schoolId || user.id === userId);
    return before - mockUsers.length;
  }
}
