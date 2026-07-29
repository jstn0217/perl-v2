import type { SchoolProfile } from '../../types/SchoolProfile.js';

export interface ITenantRepository {
  createSchool(school: SchoolProfile): Promise<SchoolProfile>;
  findSchoolById(schoolId: string): Promise<SchoolProfile | null>;
  findSchoolBySlug(slug: string): Promise<SchoolProfile | null>;
  getDefaultSchool(): Promise<SchoolProfile>;
  listSchools(): Promise<SchoolProfile[]>;
  updateSchoolProfile(schoolId: string, changes: Partial<SchoolProfile>): Promise<SchoolProfile | null>;
}
