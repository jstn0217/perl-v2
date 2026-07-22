import type { IUserRepository } from '../interfaces/IUserRepository.js';

export class MockUserRepository implements IUserRepository {
  async listUserIds(): Promise<string[]> {
    return [];
  }
}
