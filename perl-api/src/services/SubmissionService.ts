import { randomUUID } from 'node:crypto';
import type { ISubmissionRepository, SubmissionListQuery } from '../repositories/interfaces/ISubmissionRepository.js';
import type { ITenantRepository } from '../repositories/interfaces/ITenantRepository.js';
import type { PagedResult } from '../types/Pagination.js';
import type { SchoolProfile } from '../types/SchoolProfile.js';
import type { SubmissionRecord, SubmissionSource, SubmissionStatus, SubmissionType } from '../types/Submission.js';
import type { AddressFields } from '../types/Address.js';
import { ADDRESS_FIELD_KEYS } from '../types/Address.js';
import { TenantService } from './TenantService.js';
import { DomainError } from '../utils/errors.js';

export interface SubmissionInput extends Partial<AddressFields> {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
  gradeLevelApplying?: string | null;
  guardianName?: string | null;
  message?: string | null;
}

const submissionStatuses: SubmissionStatus[] = ['NEW', 'IN_REVIEW', 'ACCEPTED', 'DECLINED'];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SHORT_FIELD_MAX_LENGTH = 255;
const LONG_FIELD_MAX_LENGTH = 2000;
const ZIP_CODE_MAX_LENGTH = 20;

const normalizeOptionalString = (value: string | null | undefined) => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : null;
};

const normalizeRequiredString = (value: string | undefined, field: string, maxLength: number) => {
  const normalized = value?.trim();

  if (!normalized) {
    throw new DomainError(`${field} is required.`);
  }

  if (normalized.length > maxLength) {
    throw new DomainError(`${field} must be ${maxLength} characters or fewer.`);
  }

  return normalized;
};

const assertOptionalMaxLength = (value: string | null, field: string, maxLength: number) => {
  if (value && value.length > maxLength) {
    throw new DomainError(`${field} must be ${maxLength} characters or fewer.`);
  }

  return value;
};

const addressFieldLabels: Record<keyof AddressFields, string> = {
  addressLine1: 'Address line 1',
  addressLine2: 'Address line 2',
  barangay: 'Barangay',
  city: 'City',
  province: 'Province',
  zipCode: 'ZIP code'
};

const normalizeAddressInput = (input: Partial<AddressFields>): AddressFields => {
  const record = {} as AddressFields;

  for (const key of ADDRESS_FIELD_KEYS) {
    const maxLength = key === 'zipCode' ? ZIP_CODE_MAX_LENGTH : SHORT_FIELD_MAX_LENGTH;
    record[key] = assertOptionalMaxLength(normalizeOptionalString(input[key]), addressFieldLabels[key], maxLength);
  }

  return record;
};

export class SubmissionService {
  private readonly tenantService: TenantService;

  constructor(
    private readonly submissionRepository: ISubmissionRepository,
    private readonly tenantRepository: ITenantRepository
  ) {
    this.tenantService = new TenantService(tenantRepository);
  }

  async create(
    schoolId: string,
    type: SubmissionType,
    source: SubmissionSource,
    input: SubmissionInput
  ): Promise<SubmissionRecord> {
    await this.requireSchool(schoolId);

    const firstName = normalizeRequiredString(input.firstName, 'First name', SHORT_FIELD_MAX_LENGTH);
    const lastName = normalizeRequiredString(input.lastName, 'Last name', SHORT_FIELD_MAX_LENGTH);
    const email = normalizeRequiredString(input.email, 'Email', SHORT_FIELD_MAX_LENGTH).toLowerCase();

    if (!emailPattern.test(email)) {
      throw new DomainError('A valid email address is required.');
    }

    const phone = assertOptionalMaxLength(normalizeOptionalString(input.phone), 'Phone', SHORT_FIELD_MAX_LENGTH);
    const addressFields = normalizeAddressInput(input);
    const guardianName = assertOptionalMaxLength(
      normalizeOptionalString(input.guardianName),
      'Guardian name',
      SHORT_FIELD_MAX_LENGTH
    );

    let gradeLevelApplying: string | null = null;
    let message: string | null = null;

    if (type === 'ENROLLMENT') {
      gradeLevelApplying = normalizeRequiredString(
        input.gradeLevelApplying ?? undefined,
        'Grade level applying for',
        SHORT_FIELD_MAX_LENGTH
      );
    } else {
      message = normalizeRequiredString(input.message ?? undefined, 'Message', LONG_FIELD_MAX_LENGTH);
    }

    const now = new Date().toISOString();
    const record: SubmissionRecord = {
      id: `submission-${randomUUID()}`,
      schoolId,
      type,
      status: 'NEW',
      source,
      firstName,
      lastName,
      email,
      phone,
      gradeLevelApplying,
      guardianName,
      message,
      notes: null,
      createdAt: now,
      updatedAt: now,
      ...addressFields
    };

    return this.submissionRepository.create(record);
  }

  async createPublic(
    school: SchoolProfile,
    type: SubmissionType,
    input: SubmissionInput
  ): Promise<SubmissionRecord> {
    const featureKey = type === 'ENROLLMENT' ? 'enrollment' : 'inquiry';

    if (!this.tenantService.isFeatureEnabled(school, featureKey)) {
      throw new DomainError('Not found.', 404);
    }

    return this.create(school.id, type, 'PUBLIC', input);
  }

  async listPaged(schoolId: string, query: SubmissionListQuery): Promise<PagedResult<SubmissionRecord>> {
    await this.requireSchool(schoolId);

    return this.submissionRepository.listBySchoolPaged(schoolId, query);
  }

  async updateStatusAndNotes(
    schoolId: string,
    id: string,
    changes: { status?: string; notes?: string | null }
  ): Promise<SubmissionRecord> {
    await this.requireSchool(schoolId);

    const updates: Partial<SubmissionRecord> = { updatedAt: new Date().toISOString() };

    if (changes.status !== undefined) {
      if (!submissionStatuses.includes(changes.status as SubmissionStatus)) {
        throw new DomainError(`Status must be one of: ${submissionStatuses.join(', ')}.`);
      }
      updates.status = changes.status as SubmissionStatus;
    }

    if (changes.notes !== undefined) {
      updates.notes = assertOptionalMaxLength(
        normalizeOptionalString(changes.notes),
        'Notes',
        LONG_FIELD_MAX_LENGTH
      );
    }

    const updated = await this.submissionRepository.update(schoolId, id, updates);

    if (!updated) {
      throw new DomainError('Submission not found.', 404);
    }

    return updated;
  }

  private async requireSchool(schoolId: string): Promise<void> {
    const school = await this.tenantRepository.findSchoolById(schoolId);

    if (!school) {
      throw new DomainError('School not found.', 404);
    }
  }
}
