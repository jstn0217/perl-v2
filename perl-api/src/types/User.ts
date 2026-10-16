import type { AddressFields } from './Address.js';

export type SchoolUserRole = 'ADMIN' | 'STAFF' | 'STUDENT' | 'GUARDIAN';
export type PlatformUserRole = 'SYSTEM_ADMIN' | 'SUPPORT';
export type UserRole = SchoolUserRole | PlatformUserRole;

export interface UserRecord extends AddressFields {
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
  imageUrl: string | null;
  phoneNumber?: string | null;
  linkedStudentIds?: string[];
  isActive: boolean;
  // Optional custom RoleDefinition assignment (see types/Role.ts). Only ever
  // meaningful for ADMIN/STAFF users; null/undefined means "use base-role
  // permission defaults".
  roleDefinitionId?: string | null;
}

export interface SessionUser {
  id: string;
  schoolId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  roleDefinitionId?: string | null;
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
