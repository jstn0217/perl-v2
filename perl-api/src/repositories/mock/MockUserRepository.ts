import type { PagedResult } from '../../types/Pagination.js';
import type { UserRecord } from '../../types/User.js';
import type { IUserRepository, UserListQuery } from '../interfaces/IUserRepository.js';
import { createMockUsers } from './seeds.js';

let mockUsers: UserRecord[] = createMockUsers();

export const resetMockUsers = () => {
  mockUsers = createMockUsers();
};

const compareUsersByField = (
  field: string,
  a: { user: UserRecord; index: number },
  b: { user: UserRecord; index: number }
): number => {
  switch (field) {
    case 'email':
      return a.user.email.localeCompare(b.user.email);
    case 'role':
      return a.user.role.localeCompare(b.user.role);
    case 'status':
      return Number(a.user.isActive) - Number(b.user.isActive);
    case 'createdAt':
      // Mock array order reflects insertion/creation order; use it as a createdAt stand-in.
      return a.index - b.index;
    case 'name':
    default:
      return (
        a.user.lastName.localeCompare(b.user.lastName) ||
        a.user.firstName.localeCompare(b.user.firstName)
      );
  }
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

  async listBySchoolPaged(schoolId: string, query: UserListQuery): Promise<PagedResult<UserRecord>> {
    const search = query.search?.trim().toLowerCase();

    const matches = mockUsers
      .map((user, index) => ({ user, index }))
      .filter(({ user }) => {
        if (user.schoolId !== schoolId) return false;
        if (query.role && user.role !== query.role) return false;
        if (query.status === 'active' && !user.isActive) return false;
        if (query.status === 'inactive' && user.isActive) return false;
        if (search) {
          const haystack = `${user.firstName} ${user.lastName} ${user.email} ${user.cardUid ?? ''} ${
            user.section ?? ''
          }`.toLowerCase();
          if (!haystack.includes(search)) return false;
        }
        return true;
      });

    const direction = query.dir === 'desc' ? -1 : 1;
    const sortField = query.sort ?? 'name';

    matches.sort((a, b) => {
      const compared = compareUsersByField(sortField, a, b);
      if (compared !== 0) return compared * direction;
      return a.user.id.localeCompare(b.user.id);
    });

    const total = matches.length;
    const start = (query.page - 1) * query.pageSize;
    const items = matches.slice(start, start + query.pageSize).map(({ user }) => user);

    return { items, total };
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
