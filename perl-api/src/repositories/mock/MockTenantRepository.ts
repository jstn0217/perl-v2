import type { SchoolProfile } from '../../types/SchoolProfile.js';
import type { ITenantRepository } from '../interfaces/ITenantRepository.js';
import { createMockSchools } from './seeds.js';

let mockSchools: SchoolProfile[] = createMockSchools();

export const resetMockSchools = () => {
  mockSchools = createMockSchools();
};

export class MockTenantRepository implements ITenantRepository {
  async createSchool(school: SchoolProfile): Promise<SchoolProfile> {
    if (mockSchools.some((entry) => entry.id === school.id || entry.slug === school.slug)) {
      throw new Error('A school with that ID or slug already exists.');
    }

    mockSchools.push(school);
    return school;
  }

  async findSchoolById(schoolId: string): Promise<SchoolProfile | null> {
    return mockSchools.find((school) => school.id === schoolId) ?? null;
  }

  async findSchoolBySlug(slug: string): Promise<SchoolProfile | null> {
    return mockSchools.find((school) => school.slug === slug) ?? null;
  }

  async getDefaultSchool(): Promise<SchoolProfile> {
    return mockSchools[0];
  }

  async listSchools(): Promise<SchoolProfile[]> {
    return mockSchools;
  }

  async updateSchoolProfile(schoolId: string, changes: Partial<SchoolProfile>): Promise<SchoolProfile | null> {
    const school = mockSchools.find((entry) => entry.id === schoolId);

    if (!school) {
      return null;
    }

    if (changes.slug && changes.slug !== school.slug) {
      return null;
    }

    if (changes.name !== undefined) {
      school.name = changes.name;
    }

    if (changes.logoUrl !== undefined) {
      school.logoUrl = changes.logoUrl;
    }

    if (changes.contactEmail !== undefined) {
      school.contactEmail = changes.contactEmail;
    }

    if (changes.smsEnabled !== undefined) {
      school.smsEnabled = changes.smsEnabled;
    }

    if (changes.smsSenderName !== undefined) {
      school.smsSenderName = changes.smsSenderName;
    }

    if (changes.features !== undefined) {
      school.features = { ...school.features, ...changes.features };
    }

    if (changes.address !== undefined) {
      school.address = changes.address;
    }

    if (changes.phone !== undefined) {
      school.phone = changes.phone;
    }

    if (changes.timezone !== undefined) {
      school.timezone = changes.timezone;
    }

    if (changes.academicYearLabel !== undefined) {
      school.academicYearLabel = changes.academicYearLabel;
    }

    if (changes.depedSchoolId !== undefined) {
      school.depedSchoolId = changes.depedSchoolId;
    }

    if (changes.theme) {
      school.theme = {
        ...school.theme,
        ...changes.theme
      };
    }

    return school;
  }
}
