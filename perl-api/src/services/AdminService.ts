import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { DomainError } from '../utils/errors.js';
import type { ITenantRepository } from '../repositories/interfaces/ITenantRepository.js';
import type { IUserRepository, UserListQuery } from '../repositories/interfaces/IUserRepository.js';
import type { IRoleRepository } from '../repositories/interfaces/IRoleRepository.js';
import type { PagedResult } from '../types/Pagination.js';
import type { SchoolProfile } from '../types/SchoolProfile.js';
import type { SchoolUserRole, UserRecord } from '../types/User.js';
import type { RoleDefinition } from '../types/Role.js';
import type { AddressFields } from '../types/Address.js';
import { ADDRESS_FIELD_KEYS } from '../types/Address.js';
import { BUILTIN_ROLE_DEFINITION_IDS } from '../auth/rolePermissions.js';

export interface AssignableRoleView {
  id: string;
  name: string;
  description: string | null;
  baseRole: RoleDefinition['baseRole'];
  permissions: RoleDefinition['permissions'];
}

export interface ManagedUserView extends AddressFields {
  id: string;
  schoolId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: SchoolUserRole;
  cardUid: string | null;
  gradeLevel: string | null;
  schoolIdNumber: string | null;
  section: string | null;
  imageUrl: string | null;
  phoneNumber: string | null;
  linkedStudentIds: string[];
  isActive: boolean;
  roleDefinitionId: string | null;
}

export interface CreateManagedUserInput extends Partial<AddressFields> {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: SchoolUserRole;
  cardUid?: string | null;
  gradeLevel?: string | null;
  schoolIdNumber?: string | null;
  section?: string | null;
  imageUrl?: string | null;
  phoneNumber?: string | null;
  linkedStudentIds?: string[];
  linkedGuardianIds?: string[];
  roleDefinitionId?: string | null;
}

export interface UpdateManagedUserInput extends Partial<AddressFields> {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: SchoolUserRole;
  cardUid?: string | null;
  gradeLevel?: string | null;
  schoolIdNumber?: string | null;
  section?: string | null;
  imageUrl?: string | null;
  phoneNumber?: string | null;
  linkedStudentIds?: string[];
  linkedGuardianIds?: string[];
  roleDefinitionId?: string | null;
}

// CSV import never carries a role definition assignment — importers manage
// base roles only. See AdminService.importUsers, which strips the field even
// if a malformed row payload includes it.
export interface ImportManagedUserInput
  extends Omit<CreateManagedUserInput, 'linkedStudentIds' | 'roleDefinitionId'> {
  linkedStudentEmails?: string[];
}

export interface ImportManagedUserResult {
  created: ManagedUserView[];
  updated: ManagedUserView[];
  errors: Array<{ row: number; message: string }>;
}

export interface SchoolSummary {
  school: SchoolProfile;
  counts: {
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    admins: number;
    staff: number;
    students: number;
    guardians: number;
  };
}

const validRoles: SchoolUserRole[] = ['ADMIN', 'STAFF', 'STUDENT', 'GUARDIAN'];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const hexPattern = /^#[0-9a-fA-F]{6}$/;

const normalizeOptionalString = (value: string | null | undefined) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : null;
};

const ADDRESS_MAX_LENGTH = 255;
const ZIP_CODE_MAX_LENGTH = 20;

const assertOptionalMaxLength = (value: string | null | undefined, field: string, maxLength: number) => {
  if (value && value.length > maxLength) {
    throw new DomainError(`${field} must be ${maxLength} characters or fewer.`);
  }

  return value ?? null;
};

// Normalizes only the address fields present on `input`, leaving the rest of `changes`
// untouched — callers merge the result in themselves so "field not sent" still means
// "leave unchanged" for partial updates.
const normalizeAddressFields = (input: Partial<AddressFields>): Partial<AddressFields> => {
  const changes: Partial<AddressFields> = {};

  for (const key of ADDRESS_FIELD_KEYS) {
    if (input[key] === undefined) continue;
    const maxLength = key === 'zipCode' ? ZIP_CODE_MAX_LENGTH : ADDRESS_MAX_LENGTH;
    const label = key === 'zipCode' ? 'ZIP code' : key;
    changes[key] = assertOptionalMaxLength(normalizeOptionalString(input[key]), label, maxLength);
  }

  return changes;
};

// Same normalization as normalizeAddressFields, but always returns all six keys
// (missing input becomes null) — used where a full AddressFields value is required,
// such as constructing a brand-new record.
const toAddressFieldsRecord = (input: Partial<AddressFields>): AddressFields => {
  const record = {} as AddressFields;

  for (const key of ADDRESS_FIELD_KEYS) {
    const maxLength = key === 'zipCode' ? ZIP_CODE_MAX_LENGTH : ADDRESS_MAX_LENGTH;
    const label = key === 'zipCode' ? 'ZIP code' : key;
    record[key] = assertOptionalMaxLength(normalizeOptionalString(input[key]), label, maxLength);
  }

  return record;
};

const validateOptionalImageUrl = (value: string | null | undefined) => {
  const normalized = normalizeOptionalString(value);

  if (!normalized) {
    return normalized;
  }

  let parsed: URL;

  try {
    parsed = new URL(normalized);
  } catch {
    throw new DomainError('Image URL must be a valid https URL.');
  }

  if (parsed.protocol !== 'https:') {
    throw new DomainError('Image URL must be a valid https URL.');
  }

  return normalized;
};

const normalizeRequiredString = (value: string | undefined, field: string) => {
  const normalized = value?.trim();

  if (!normalized) {
    throw new DomainError(`${field} is required.`);
  }

  return normalized;
};

const assertEmail = (value: string) => {
  if (!emailPattern.test(value)) {
    throw new DomainError('A valid email address is required.');
  }
};

const assertRole = (value: string | undefined): SchoolUserRole => {
  if (!value || !validRoles.includes(value as SchoolUserRole)) {
    throw new DomainError('A valid role is required.');
  }

  return value as SchoolUserRole;
};

const assertPassword = (value: string | undefined) => {
  if (!value || value.trim().length < 8) {
    throw new DomainError('Password must be at least 8 characters.');
  }

  return value;
};

const assertHex = (value: string, label: string) => {
  if (!hexPattern.test(value)) {
    throw new DomainError(`${label} must be a valid hex color.`);
  }
};

const assertUniqueCardUid = async (
  userRepository: IUserRepository,
  schoolId: string,
  candidateCardUid: string | null | undefined,
  currentUserId?: string
) => {
  if (!candidateCardUid) {
    return;
  }

  const conflictingUser = await userRepository.findByCardUid(candidateCardUid, {
    includeInactive: true
  });

  if (!conflictingUser || conflictingUser.id === currentUserId) {
    return;
  }

  if (conflictingUser.schoolId === schoolId) {
    throw new DomainError('A user with that card UID already exists for this school.');
  }

  throw new DomainError('Card UID values must remain unique across schools.');
};

const assertUniqueSchoolIdNumber = async (
  userRepository: IUserRepository,
  schoolId: string,
  candidateSchoolIdNumber: string | null | undefined,
  currentUserId?: string
) => {
  if (!candidateSchoolIdNumber) {
    return;
  }

  const conflictingUser = await userRepository.findBySchoolIdNumber(schoolId, candidateSchoolIdNumber, {
    includeInactive: true
  });

  if (!conflictingUser || conflictingUser.id === currentUserId) {
    return;
  }

  throw new DomainError('A user with that school ID number already exists for this school.');
};

export class AdminService {
  constructor(
    private readonly tenantRepository: ITenantRepository,
    private readonly userRepository: IUserRepository,
    private readonly roleRepository?: IRoleRepository
  ) {}

  // Assignment is only valid when: the target base role matches the
  // definition's baseRole, the definition is a persisted (non-virtual)
  // custom role, and it is currently active. Deactivated/virtual/wrong-role
  // assignments are rejected outright rather than silently ignored, so an
  // admin never ends up with a user pointing at a role that can't apply.
  private async assertRoleDefinitionAssignable(
    baseRole: SchoolUserRole,
    roleDefinitionId: string
  ): Promise<void> {
    if (!this.roleRepository) {
      throw new DomainError('Custom role assignment is not available.');
    }

    if ((Object.values(BUILTIN_ROLE_DEFINITION_IDS) as string[]).includes(roleDefinitionId)) {
      throw new DomainError('Built-in roles cannot be assigned directly; leave roleDefinitionId unset instead.');
    }

    const definition = await this.roleRepository.findById(roleDefinitionId);

    if (!definition) {
      throw new DomainError('Role not found.', 404);
    }

    if (!definition.isActive) {
      throw new DomainError('This role is deactivated and cannot be assigned.');
    }

    if (definition.baseRole !== baseRole) {
      throw new DomainError(`This role can only be assigned to ${definition.baseRole} users.`);
    }
  }

  // Assignable custom roles for the user-management UI's role picker: active,
  // persisted role definitions only. Built-in roles need no entry here since
  // they apply automatically whenever roleDefinitionId is left unset.
  async listAssignableRoles(): Promise<AssignableRoleView[]> {
    if (!this.roleRepository) {
      return [];
    }

    const roles = await this.roleRepository.list();

    return roles
      .filter((role) => role.isActive)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((role) => ({
        id: role.id,
        name: role.name,
        description: role.description,
        baseRole: role.baseRole,
        permissions: role.permissions
      }));
  }

  async getSchoolSummary(schoolId: string): Promise<SchoolSummary> {
    const [school, users] = await Promise.all([
      this.requireSchool(schoolId),
      this.userRepository.listBySchool(schoolId)
    ]);

    return {
      school,
      counts: {
        totalUsers: users.length,
        activeUsers: users.filter((user) => user.isActive).length,
        inactiveUsers: users.filter((user) => !user.isActive).length,
        admins: users.filter((user) => user.role === 'ADMIN').length,
        staff: users.filter((user) => user.role === 'STAFF').length,
        students: users.filter((user) => user.role === 'STUDENT').length,
        guardians: users.filter((user) => user.role === 'GUARDIAN').length
      }
    };
  }

  async getSchoolProfile(schoolId: string): Promise<SchoolProfile> {
    return this.requireSchool(schoolId);
  }

  async updateSchoolProfile(
    schoolId: string,
    input: Partial<
      Pick<
        SchoolProfile,
        | 'name'
        | 'logoUrl'
        | 'contactEmail'
        | 'theme'
        | 'phone'
        | 'timezone'
        | 'academicYearLabel'
        | 'depedSchoolId'
      >
    > &
      Partial<AddressFields>
  ): Promise<SchoolProfile> {
    const existing = await this.requireSchool(schoolId);
    const nextName = input.name !== undefined ? normalizeRequiredString(input.name, 'School name') : existing.name;
    const nextContactEmail =
      input.contactEmail !== undefined ? normalizeRequiredString(input.contactEmail, 'Contact email') : existing.contactEmail;
    const nextLogoUrl = input.logoUrl !== undefined ? normalizeOptionalString(input.logoUrl) : existing.logoUrl;
    const nextTheme = {
      primaryColor: input.theme?.primaryColor ?? existing.theme.primaryColor,
      secondaryColor: input.theme?.secondaryColor ?? existing.theme.secondaryColor,
      accentColor: input.theme?.accentColor ?? existing.theme.accentColor
    };
    const addressChanges = normalizeAddressFields(input);
    const nextPhone = input.phone !== undefined ? normalizeOptionalString(input.phone) : existing.phone;
    const nextTimezone =
      input.timezone !== undefined ? normalizeRequiredString(input.timezone, 'Timezone') : existing.timezone;
    const nextAcademicYearLabel =
      input.academicYearLabel !== undefined
        ? normalizeOptionalString(input.academicYearLabel)
        : existing.academicYearLabel;
    const nextDepedSchoolId =
      input.depedSchoolId !== undefined ? normalizeOptionalString(input.depedSchoolId) : existing.depedSchoolId;

    assertEmail(nextContactEmail);
    assertHex(nextTheme.primaryColor, 'Primary color');
    assertHex(nextTheme.secondaryColor, 'Secondary color');
    assertHex(nextTheme.accentColor, 'Accent color');

    const updated = await this.tenantRepository.updateSchoolProfile(schoolId, {
      name: nextName,
      logoUrl: nextLogoUrl,
      contactEmail: nextContactEmail,
      theme: nextTheme,
      phone: nextPhone,
      timezone: nextTimezone,
      academicYearLabel: nextAcademicYearLabel,
      depedSchoolId: nextDepedSchoolId,
      ...addressChanges
    });

    if (!updated) {
      throw new DomainError('School not found.', 404);
    }

    return updated;
  }

  async listUsers(schoolId: string): Promise<ManagedUserView[]> {
    await this.requireSchool(schoolId);
    const users = await this.userRepository.listBySchool(schoolId);

    return users.map((user) => this.toManagedUserView(user));
  }

  async listUsersPaged(schoolId: string, query: UserListQuery): Promise<PagedResult<ManagedUserView>> {
    await this.requireSchool(schoolId);
    const { items, total } = await this.userRepository.listBySchoolPaged(schoolId, query);

    return { items: items.map((user) => this.toManagedUserView(user)), total };
  }

  async createUser(schoolId: string, input: CreateManagedUserInput): Promise<ManagedUserView> {
    await this.requireSchool(schoolId);

    const email = normalizeRequiredString(input.email, 'Email').toLowerCase();
    const firstName = normalizeRequiredString(input.firstName, 'First name');
    const lastName = normalizeRequiredString(input.lastName, 'Last name');
    const role = assertRole(input.role);
    const password = assertPassword(input.password);

    assertEmail(email);

    const existingUser = await this.userRepository.findByEmail(email, {
      includeInactive: true
    });

    if (existingUser) {
      throw new DomainError('A user with that email already exists.');
    }

    const cardUid = normalizeOptionalString(input.cardUid);
    const linkedStudentIds =
      role === 'GUARDIAN'
        ? await this.assertLinkedStudents(schoolId, input.linkedStudentIds ?? [])
        : [];

    const schoolIdNumber = normalizeOptionalString(input.schoolIdNumber);

    await assertUniqueCardUid(this.userRepository, schoolId, cardUid);
    await assertUniqueSchoolIdNumber(this.userRepository, schoolId, schoolIdNumber);

    const roleDefinitionId = normalizeOptionalString(input.roleDefinitionId) ?? null;
    if (roleDefinitionId) {
      await this.assertRoleDefinitionAssignable(role, roleDefinitionId);
    }

    const user: UserRecord = {
      id: `user-${schoolId}-${randomUUID()}`,
      schoolId,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      firstName,
      lastName,
      role,
      cardUid: cardUid ?? null,
      gradeLevel: normalizeOptionalString(input.gradeLevel) ?? null,
      schoolIdNumber: schoolIdNumber ?? null,
      section: normalizeOptionalString(input.section) ?? null,
      ...toAddressFieldsRecord(input),
      imageUrl: validateOptionalImageUrl(input.imageUrl) ?? null,
      phoneNumber: normalizeOptionalString(input.phoneNumber) ?? null,
      linkedStudentIds,
      isActive: true,
      roleDefinitionId
    };

    const created = await this.userRepository.create(user);

    if (role === 'STUDENT' && input.linkedGuardianIds !== undefined) {
      const guardianIds = await this.assertLinkedGuardians(schoolId, input.linkedGuardianIds);
      await this.syncGuardianLinksForStudent(schoolId, created.id, guardianIds);
    }

    return this.toManagedUserView(created);
  }

  /**
   * Imports school users from a spreadsheet upload.
   *
   * Match key: a row's trimmed, non-empty `schoolIdNumber` matched against an
   * existing user in the same school. A match UPDATES that user; rows with a
   * blank/missing `schoolIdNumber` are always CREATE-only (unchanged behavior,
   * still error on duplicate email/cardUid).
   *
   * Conflict rule: if a row matches user A by schoolIdNumber but its email or
   * cardUid belongs to a different existing user B, the row errors out rather
   * than overwriting either record.
   *
   * On update, password is optional: a non-empty row password is re-hashed
   * and replaces the stored hash; a blank row password leaves the existing
   * hash untouched. `id` and `isActive` are always preserved on update — an
   * import row never reactivates a deactivated user.
   */
  async importUsers(
    schoolId: string,
    rows: ImportManagedUserInput[]
  ): Promise<ImportManagedUserResult> {
    await this.requireSchool(schoolId);
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new DomainError('Import must contain at least one user row.');
    }
    if (rows.length > 500) {
      throw new DomainError('Import is limited to 500 user rows at a time.');
    }

    // Import rows never carry a role definition assignment, even if a malformed
    // upload payload includes one — CSV import manages base roles only.
    const indexedRows = rows.map((rawInput, index) => {
      const { roleDefinitionId, ...input } = rawInput as ImportManagedUserInput & {
        roleDefinitionId?: unknown;
      };
      void roleDefinitionId;
      return { input, row: index + 2 };
    });
    const orderedRows = [
      ...indexedRows.filter(({ input }) => input.role !== 'GUARDIAN'),
      ...indexedRows.filter(({ input }) => input.role === 'GUARDIAN')
    ];
    const created: ManagedUserView[] = [];
    const updated: ManagedUserView[] = [];
    const errors: ImportManagedUserResult['errors'] = [];

    // Track the first row each schoolIdNumber appears at in the uploaded file
    // (in file order, not processing order). A later row matching the same
    // schoolIdNumber would otherwise upsert against the user the earlier row
    // in this same upload just created/updated, silently overwriting it.
    const schoolIdNumberFirstRow = new Map<string, number>();
    for (const { input, row } of indexedRows) {
      const normalized = normalizeOptionalString(input.schoolIdNumber);
      if (normalized && !schoolIdNumberFirstRow.has(normalized)) {
        schoolIdNumberFirstRow.set(normalized, row);
      }
    }

    for (const { input, row } of orderedRows) {
      try {
        const schoolIdNumber = normalizeOptionalString(input.schoolIdNumber);
        const firstRow = schoolIdNumber ? schoolIdNumberFirstRow.get(schoolIdNumber) : undefined;
        if (schoolIdNumber && firstRow !== row) {
          throw new DomainError(`duplicate school ID number in file, first used at row ${firstRow}`);
        }

        const linkedStudentIds: string[] = [];
        if (input.role === 'GUARDIAN') {
          for (const linkedEmail of input.linkedStudentEmails ?? []) {
            const student = await this.userRepository.findByEmail(linkedEmail.trim().toLowerCase());
            if (!student || student.schoolId !== schoolId || student.role !== 'STUDENT') {
              throw new DomainError(`Linked student ${linkedEmail} was not found in this school.`);
            }
            linkedStudentIds.push(student.id);
          }
        }

        const existingMatch = schoolIdNumber
          ? await this.userRepository.findBySchoolIdNumber(schoolId, schoolIdNumber, {
              includeInactive: true
            })
          : null;

        if (existingMatch && schoolIdNumber) {
          updated.push(
            await this.updateImportedUser(schoolId, existingMatch, schoolIdNumber, {
              ...input,
              linkedStudentIds
            })
          );
        } else {
          created.push(await this.createUser(schoolId, { ...input, linkedStudentIds }));
        }
      } catch (error) {
        errors.push({
          row,
          message: error instanceof Error ? error.message : 'Unable to import this user.'
        });
      }
    }

    return { created, updated, errors: errors.sort((left, right) => left.row - right.row) };
  }

  private async updateImportedUser(
    schoolId: string,
    existing: UserRecord,
    schoolIdNumber: string,
    input: ImportManagedUserInput & { linkedStudentIds: string[] }
  ): Promise<ManagedUserView> {
    const conflictMessage = `Row matches student ID ${schoolIdNumber} (user ${existing.id}) but its email/card UID belongs to a different user.`;

    if (input.email !== undefined) {
      const email = normalizeRequiredString(input.email, 'Email').toLowerCase();
      const conflicting = await this.userRepository.findByEmail(email, { includeInactive: true });
      if (conflicting && conflicting.id !== existing.id) {
        throw new DomainError(conflictMessage);
      }
    }

    const candidateCardUid = normalizeOptionalString(input.cardUid);
    if (candidateCardUid) {
      const conflicting = await this.userRepository.findByCardUid(candidateCardUid, {
        includeInactive: true
      });
      if (conflicting && conflicting.id !== existing.id) {
        throw new DomainError(conflictMessage);
      }
    }

    const updateInput: UpdateManagedUserInput = {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      cardUid: input.cardUid,
      gradeLevel: input.gradeLevel,
      schoolIdNumber: input.schoolIdNumber,
      section: input.section,
      imageUrl: input.imageUrl,
      phoneNumber: input.phoneNumber,
      linkedStudentIds: input.linkedStudentIds,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      barangay: input.barangay,
      city: input.city,
      province: input.province,
      zipCode: input.zipCode
    };

    if (input.password && input.password.trim().length > 0) {
      updateInput.password = input.password;
    }

    return this.updateUser(schoolId, existing.id, updateInput);
  }

  async updateUser(schoolId: string, userId: string, input: UpdateManagedUserInput): Promise<ManagedUserView> {
    const existing = await this.requireSchoolUser(schoolId, userId);
    const changes: Partial<UserRecord> = {};

    if (input.email !== undefined) {
      const email = normalizeRequiredString(input.email, 'Email').toLowerCase();
      assertEmail(email);

      const conflicting = await this.userRepository.findByEmail(email, {
        includeInactive: true
      });

      if (conflicting && conflicting.id !== userId) {
        throw new DomainError('A user with that email already exists.');
      }

      changes.email = email;
    }

    if (input.firstName !== undefined) {
      changes.firstName = normalizeRequiredString(input.firstName, 'First name');
    }

    if (input.lastName !== undefined) {
      changes.lastName = normalizeRequiredString(input.lastName, 'Last name');
    }

    if (input.role !== undefined) {
      changes.role = assertRole(input.role);
    }

    if (input.password !== undefined) {
      changes.passwordHash = await bcrypt.hash(assertPassword(input.password), 12);
    }

    if (input.cardUid !== undefined) {
      changes.cardUid = normalizeOptionalString(input.cardUid);
      await assertUniqueCardUid(this.userRepository, schoolId, changes.cardUid, userId);
    }

    if (input.gradeLevel !== undefined) {
      changes.gradeLevel = normalizeOptionalString(input.gradeLevel);
    }

    if (input.schoolIdNumber !== undefined) {
      changes.schoolIdNumber = normalizeOptionalString(input.schoolIdNumber);
      await assertUniqueSchoolIdNumber(this.userRepository, schoolId, changes.schoolIdNumber, userId);
    }

    if (input.section !== undefined) {
      changes.section = normalizeOptionalString(input.section);
    }

    Object.assign(changes, normalizeAddressFields(input));

    if (input.imageUrl !== undefined) {
      changes.imageUrl = validateOptionalImageUrl(input.imageUrl);
    }

    if (input.phoneNumber !== undefined) {
      changes.phoneNumber = normalizeOptionalString(input.phoneNumber);
    }

    const nextRole = changes.role ?? existing.role;

    if (input.roleDefinitionId !== undefined) {
      const roleDefinitionId = normalizeOptionalString(input.roleDefinitionId) ?? null;
      if (roleDefinitionId) {
        await this.assertRoleDefinitionAssignable(nextRole, roleDefinitionId);
      }
      changes.roleDefinitionId = roleDefinitionId;
    }

    if (input.linkedStudentIds !== undefined) {
      changes.linkedStudentIds =
        nextRole === 'GUARDIAN'
          ? await this.assertLinkedStudents(schoolId, input.linkedStudentIds)
          : [];
    } else if (input.role !== undefined && nextRole !== 'GUARDIAN') {
      changes.linkedStudentIds = [];
    }

    const updated = await this.userRepository.update(existing.id, schoolId, changes);

    if (!updated) {
      throw new DomainError('User not found.', 404);
    }

    if (nextRole === 'STUDENT' && input.linkedGuardianIds !== undefined) {
      const guardianIds = await this.assertLinkedGuardians(schoolId, input.linkedGuardianIds);
      await this.syncGuardianLinksForStudent(schoolId, updated.id, guardianIds);
    }

    return this.toManagedUserView(updated);
  }

  async deactivateUser(schoolId: string, userId: string, actorUserId: string): Promise<ManagedUserView> {
    if (userId === actorUserId) {
      throw new DomainError('You cannot deactivate your own account.');
    }

    const existing = await this.requireSchoolUser(schoolId, userId);

    if (!existing.isActive) {
      return this.toManagedUserView(existing);
    }

    const updated = await this.userRepository.deactivate(userId, schoolId);

    if (!updated) {
      throw new DomainError('User not found.', 404);
    }

    return this.toManagedUserView(updated);
  }

  async reactivateUser(schoolId: string, userId: string): Promise<ManagedUserView> {
    const existing = await this.requireSchoolUser(schoolId, userId);

    if (existing.isActive) {
      return this.toManagedUserView(existing);
    }

    const updated = await this.userRepository.update(userId, schoolId, { isActive: true });

    if (!updated) {
      throw new DomainError('User not found.', 404);
    }

    return this.toManagedUserView(updated);
  }

  async bulkSetUserStatus(
    schoolId: string,
    userIds: string[],
    isActive: boolean,
    actorUserId: string
  ): Promise<{ updated: ManagedUserView[]; errors: { userId: string; message: string }[] }> {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new DomainError('At least one user ID is required.');
    }

    if (userIds.length > 100) {
      throw new DomainError('Cannot update more than 100 users at once.');
    }

    if (!userIds.every((id) => typeof id === 'string' && id.trim().length > 0)) {
      throw new DomainError('User IDs must be non-empty strings.');
    }

    const updated: ManagedUserView[] = [];
    const errors: { userId: string; message: string }[] = [];

    for (const userId of userIds) {
      try {
        if (!isActive && userId === actorUserId) {
          throw new DomainError('You cannot deactivate your own account.');
        }

        const existing = await this.requireSchoolUser(schoolId, userId);

        if (existing.isActive === isActive) {
          updated.push(this.toManagedUserView(existing));
          continue;
        }

        const result = await this.userRepository.update(userId, schoolId, { isActive });

        if (!result) {
          throw new DomainError('User not found.', 404);
        }

        updated.push(this.toManagedUserView(result));
      } catch (error) {
        const message = error instanceof DomainError ? error.message : 'User not found.';
        errors.push({ userId, message });
      }
    }

    return { updated, errors };
  }

  private async requireSchool(schoolId: string): Promise<SchoolProfile> {
    const school = await this.tenantRepository.findSchoolById(schoolId);

    if (!school) {
      throw new DomainError('School not found.', 404);
    }

    return school;
  }

  private async requireSchoolUser(schoolId: string, userId: string): Promise<UserRecord> {
    const user = await this.userRepository.findById(userId);

    if (!user || user.schoolId !== schoolId) {
      throw new DomainError('User not found.', 404);
    }

    return user;
  }

  private async assertLinkedStudents(schoolId: string, studentIds: string[]): Promise<string[]> {
    const uniqueStudentIds = [...new Set(studentIds)];

    for (const studentId of uniqueStudentIds) {
      const student = await this.userRepository.findById(studentId);
      if (!student || student.schoolId !== schoolId || student.role !== 'STUDENT') {
        throw new DomainError('Guardian links must reference students from the same school.');
      }
    }

    return uniqueStudentIds;
  }

  private async assertLinkedGuardians(schoolId: string, guardianIds: string[]): Promise<string[]> {
    const uniqueGuardianIds = [...new Set(guardianIds)];

    for (const guardianId of uniqueGuardianIds) {
      const guardian = await this.userRepository.findById(guardianId);
      if (!guardian || guardian.schoolId !== schoolId || guardian.role !== 'GUARDIAN') {
        throw new DomainError('Guardian links must reference guardians from the same school.');
      }
    }

    return uniqueGuardianIds;
  }

  private async syncGuardianLinksForStudent(
    schoolId: string,
    studentId: string,
    guardianIds: string[]
  ): Promise<void> {
    const nextGuardianIds = new Set(guardianIds);
    const schoolUsers = await this.userRepository.listBySchool(schoolId);
    const currentGuardians = schoolUsers.filter(
      (user) => user.role === 'GUARDIAN' && (user.linkedStudentIds ?? []).includes(studentId)
    );
    const currentGuardianIds = new Set(currentGuardians.map((guardian) => guardian.id));

    for (const guardian of currentGuardians) {
      if (!nextGuardianIds.has(guardian.id)) {
        await this.userRepository.update(guardian.id, schoolId, {
          linkedStudentIds: (guardian.linkedStudentIds ?? []).filter((id) => id !== studentId)
        });
      }
    }

    for (const guardianId of nextGuardianIds) {
      if (!currentGuardianIds.has(guardianId)) {
        const guardian = await this.userRepository.findById(guardianId);
        if (guardian) {
          await this.userRepository.update(guardianId, schoolId, {
            linkedStudentIds: [...new Set([...(guardian.linkedStudentIds ?? []), studentId])]
          });
        }
      }
    }
  }

  private toManagedUserView(user: UserRecord): ManagedUserView {
    return {
      id: user.id,
      schoolId: user.schoolId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      cardUid: user.cardUid,
      gradeLevel: user.gradeLevel,
      schoolIdNumber: user.schoolIdNumber,
      section: user.section,
      imageUrl: user.imageUrl,
      phoneNumber: user.phoneNumber ?? null,
      linkedStudentIds: user.linkedStudentIds ?? [],
      isActive: user.isActive,
      roleDefinitionId: user.roleDefinitionId ?? null,
      addressLine1: user.addressLine1,
      addressLine2: user.addressLine2,
      barangay: user.barangay,
      city: user.city,
      province: user.province,
      zipCode: user.zipCode
    };
  }
}
