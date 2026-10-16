import type { AddressFields } from './Address.js';

export type SubmissionType = 'ENROLLMENT' | 'INQUIRY';
export type SubmissionStatus = 'NEW' | 'IN_REVIEW' | 'ACCEPTED' | 'DECLINED';
export type SubmissionSource = 'PUBLIC' | 'MANUAL';

export interface SubmissionRecord extends AddressFields {
  id: string;
  schoolId: string;
  type: SubmissionType;
  status: SubmissionStatus;
  source: SubmissionSource;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  gradeLevelApplying: string | null;
  guardianName: string | null;
  message: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
