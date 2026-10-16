import type { PagedResult, PageQuery } from '../../types/Pagination.js';
import type { SubmissionRecord, SubmissionStatus, SubmissionType } from '../../types/Submission.js';

export interface SubmissionListQuery extends PageQuery {
  type?: SubmissionType;
  status?: SubmissionStatus;
}

export interface ISubmissionRepository {
  create(record: SubmissionRecord): Promise<SubmissionRecord>;
  findById(schoolId: string, id: string): Promise<SubmissionRecord | null>;
  listBySchoolPaged(schoolId: string, query: SubmissionListQuery): Promise<PagedResult<SubmissionRecord>>;
  listAllBySchool(schoolId: string): Promise<SubmissionRecord[]>;
  update(schoolId: string, id: string, changes: Partial<SubmissionRecord>): Promise<SubmissionRecord | null>;
  deleteBySchool(schoolId: string): Promise<number>;
}
