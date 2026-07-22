import type { ITenantRepository } from '../interfaces/ITenantRepository.js';

export class MockTenantRepository implements ITenantRepository {
  async listSchoolIds(): Promise<string[]> {
    return [];
  }
}
