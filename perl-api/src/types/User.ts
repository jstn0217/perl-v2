export type UserRole = 'ADMIN' | 'STAFF' | 'STUDENT' | 'GUARDIAN';

export interface UserRecord {
  id: string;
  schoolId: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface SessionUser {
  id: string;
  schoolId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface LoginResult {
  user: SessionUser;
}
