import type { AddressFields } from './address';

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

export interface SubmissionFields extends Partial<AddressFields> {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  gradeLevelApplying?: string | null;
  guardianName?: string | null;
  message?: string | null;
}

export interface SubmissionUpdatePayload {
  status?: SubmissionStatus;
  notes?: string | null;
}

export interface SubmissionCreatePayload extends SubmissionFields {
  type: SubmissionType;
}

export interface SubmissionPublicPayload extends SubmissionFields {
  website: string;
}

export interface IntakeInfo {
  school: {
    name: string;
    logoUrl: string | null;
    theme: { primaryColor: string; secondaryColor: string; accentColor: string };
  };
  enrollmentEnabled: boolean;
  inquiryEnabled: boolean;
}
