import type { PagedResult } from '../../types/Pagination.js';
import type { SubmissionRecord } from '../../types/Submission.js';
import type { ISubmissionRepository, SubmissionListQuery } from '../interfaces/ISubmissionRepository.js';

let mockSubmissions: SubmissionRecord[] = [];

export const resetMockSubmissions = () => {
  mockSubmissions = [];
};

const compareSubmissionsByField = (
  field: string,
  a: { submission: SubmissionRecord; index: number },
  b: { submission: SubmissionRecord; index: number }
): number => {
  switch (field) {
    case 'status':
      return a.submission.status.localeCompare(b.submission.status);
    case 'name':
      return (
        a.submission.lastName.localeCompare(b.submission.lastName) ||
        a.submission.firstName.localeCompare(b.submission.firstName)
      );
    case 'createdAt':
    default:
      return a.index - b.index;
  }
};

export class MockSubmissionRepository implements ISubmissionRepository {
  async create(record: SubmissionRecord): Promise<SubmissionRecord> {
    if (mockSubmissions.some((entry) => entry.id === record.id)) {
      throw new Error('A submission with that ID already exists.');
    }

    mockSubmissions.push(record);

    return record;
  }

  async findById(schoolId: string, id: string): Promise<SubmissionRecord | null> {
    return mockSubmissions.find((entry) => entry.id === id && entry.schoolId === schoolId) ?? null;
  }

  async listBySchoolPaged(
    schoolId: string,
    query: SubmissionListQuery
  ): Promise<PagedResult<SubmissionRecord>> {
    const search = query.search?.trim().toLowerCase();

    const matches = mockSubmissions
      .map((submission, index) => ({ submission, index }))
      .filter(({ submission }) => {
        if (submission.schoolId !== schoolId) return false;
        if (query.type && submission.type !== query.type) return false;
        if (query.status && submission.status !== query.status) return false;
        if (search) {
          const haystack = `${submission.firstName} ${submission.lastName} ${submission.email} ${
            submission.guardianName ?? ''
          }`.toLowerCase();
          if (!haystack.includes(search)) return false;
        }
        return true;
      });

    const direction = query.dir === 'desc' ? -1 : 1;
    const sortField = query.sort ?? 'createdAt';

    matches.sort((a, b) => {
      const compared = compareSubmissionsByField(sortField, a, b);
      if (compared !== 0) return compared * direction;
      return a.submission.id.localeCompare(b.submission.id);
    });

    const total = matches.length;
    const start = (query.page - 1) * query.pageSize;
    const items = matches.slice(start, start + query.pageSize).map(({ submission }) => submission);

    return { items, total };
  }

  async listAllBySchool(schoolId: string): Promise<SubmissionRecord[]> {
    return mockSubmissions.filter((submission) => submission.schoolId === schoolId);
  }

  async update(
    schoolId: string,
    id: string,
    changes: Partial<SubmissionRecord>
  ): Promise<SubmissionRecord | null> {
    const submission = mockSubmissions.find((entry) => entry.id === id && entry.schoolId === schoolId);

    if (!submission) {
      return null;
    }

    Object.assign(submission, changes);

    return submission;
  }

  async deleteBySchool(schoolId: string): Promise<number> {
    const before = mockSubmissions.length;
    mockSubmissions = mockSubmissions.filter((submission) => submission.schoolId !== schoolId);
    return before - mockSubmissions.length;
  }
}
