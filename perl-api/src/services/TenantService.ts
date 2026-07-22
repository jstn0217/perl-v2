import type { ITenantRepository } from '../repositories/interfaces/ITenantRepository.js';
import type { SchoolProfile } from '../types/SchoolProfile.js';

export class TenantService {
  constructor(private readonly tenantRepository: ITenantRepository) {}

  async getCurrentSchool(preferredSlug?: string): Promise<SchoolProfile> {
    if (preferredSlug) {
      const school = await this.tenantRepository.findSchoolBySlug(preferredSlug);

      if (school) {
        return school;
      }
    }

    return this.tenantRepository.getDefaultSchool();
  }

  async getSchoolContext(preferredSlug?: string): Promise<{
    school: SchoolProfile;
    schools: SchoolProfile[];
  }> {
    const [school, schools] = await Promise.all([
      this.getCurrentSchool(preferredSlug),
      this.tenantRepository.listSchools()
    ]);

    return { school, schools };
  }
}
