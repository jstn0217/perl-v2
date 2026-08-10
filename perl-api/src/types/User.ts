export type SchoolUserRole = 'ADMIN' | 'STAFF' | 'STUDENT' | 'GUARDIAN';
export type PlatformUserRole = 'SYSTEM_ADMIN' | 'SUPPORT';
export type UserRole = SchoolUserRole | PlatformUserRole;

export interface UserRecord {
  id: string;
  schoolId: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: SchoolUserRole;
  cardUid: string | null;
  gradeLevel: string | null;
  schoolIdNumber: string | null;
  section: string | null;
  address: string | null;
  imageUrl: string | null;
  phoneNumber?: string | null;
  linkedStudentIds?: string[];
  isActive: boolean;
}

export interface SessionUser {
  id: string;
  schoolId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface PlatformUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: PlatformUserRole;
  isActive: boolean;
}

export interface LoginResult {
  user: SessionUser;
}
