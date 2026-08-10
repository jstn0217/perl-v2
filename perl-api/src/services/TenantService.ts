import { randomUUID } from 'node:crypto';
import type { ITenantRepository } from '../repositories/interfaces/ITenantRepository.js';
import type { SchoolProfile } from '../types/SchoolProfile.js';
import type { FeatureKey } from '../types/SchoolFeature.js';

export interface CreateSchoolInput {
  name: string;
  slug: string;
  contactEmail: string;
  theme?: Partial<SchoolProfile['theme']>;
}

const defaultTheme: SchoolProfile['theme'] = {
  primaryColor: '#164E63',
  secondaryColor: '#ECF4F6',
  accentColor: '#F59E0B'
};
const hexColorPattern = /^#[0-9A-F]{6}$/i;
const schoolSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class TenantService {
  constructor(private readonly tenantRepository: ITenantRepository) {}

  async getSchoolById(schoolId: string): Promise<SchoolProfile> {
    const school = await this.tenantRepository.findSchoolById(schoolId);

    if (!school) {
      throw new Error('School not found.');
    }

    return school;
  }

  async getCurrentSchool(preferredSlug?: string): Promise<SchoolProfile> {
    if (preferredSlug) {
      const school = await this.tenantRepository.findSchoolBySlug(preferredSlug);

      if (school) {
        return school;
      }
    }

    return this.tenantRepository.getDefaultSchool();
  }

  async createSchool(input: CreateSchoolInput): Promise<SchoolProfile> {
    const name = input.name?.trim();
    const slug = input.slug?.trim().toLowerCase();
    const contactEmail = input.contactEmail?.trim().toLowerCase();

    if (!name || name.length < 2) {
      throw new Error('School name must be at least 2 characters.');
    }
    if (!slug || !schoolSlugPattern.test(slug) || slug.length > 128) {
      throw new Error('School slug must contain lowercase letters, numbers, and single hyphens only.');
    }
    if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      throw new Error('A valid school contact email is required.');
    }
    if (await this.tenantRepository.findSchoolBySlug(slug)) {
      throw new Error('That school slug is already in use.');
    }

    const theme = { ...defaultTheme, ...input.theme };
    if (Object.values(theme).some((color) => !hexColorPattern.test(color))) {
      throw new Error('School theme colors must use six-digit hex values.');
    }

    return this.tenantRepository.createSchool({
      id: `school-${randomUUID()}`,
      slug,
      name,
      logoUrl: null,
      theme,
      contactEmail,
      smsEnabled: false,
      smsSenderName: null,
      features: { sms: false },
      address: null,
      phone: null,
      timezone: 'Asia/Manila',
      academicYearLabel: null,
      depedSchoolId: null
    });
  }

  async updateSchoolProfile(
    schoolId: string,
    changes: Partial<
      Pick<
        SchoolProfile,
        | 'name'
        | 'logoUrl'
        | 'contactEmail'
        | 'theme'
        | 'address'
        | 'phone'
        | 'timezone'
        | 'academicYearLabel'
        | 'depedSchoolId'
      >
    >
  ): Promise<SchoolProfile> {
    const updated = await this.tenantRepository.updateSchoolProfile(schoolId, changes);

    if (!updated) {
      throw new Error('School not found.');
    }

    return updated;
  }

  isFeatureEnabled(school: SchoolProfile, key: FeatureKey): boolean {
    return school.features?.[key] ?? false;
  }

  async setFeature(schoolId: string, key: FeatureKey, enabled: boolean): Promise<SchoolProfile> {
    const school = await this.getSchoolById(schoolId);
    const updated = await this.tenantRepository.updateSchoolProfile(schoolId, {
      features: { ...school.features, [key]: enabled }
    });

    if (!updated) {
      throw new Error('School not found.');
    }

    return updated;
  }
}
