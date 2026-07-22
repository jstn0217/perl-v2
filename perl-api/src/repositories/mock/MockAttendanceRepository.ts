import type { IAttendanceRepository } from '../interfaces/IAttendanceRepository.js';

export class MockAttendanceRepository implements IAttendanceRepository {
  async listAttendanceIds(): Promise<string[]> {
    return [];
  }
}
