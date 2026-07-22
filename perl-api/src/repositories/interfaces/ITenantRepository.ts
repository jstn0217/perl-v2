import type { SchoolProfile } from '../../types/SchoolProfile.js';

export interface ITenantRepository {
  findSchoolBySlug(slug: string): Promise<SchoolProfile | null>;
  getDefaultSchool(): Promise<SchoolProfile>;
  listSchools(): Promise<SchoolProfile[]>;
}
