import bcrypt from 'bcrypt';
import type { IUserRepository } from '../repositories/interfaces/IUserRepository.js';
import type { IPlatformUserRepository } from '../repositories/interfaces/IPlatformUserRepository.js';
import type { IRoleRepository } from '../repositories/interfaces/IRoleRepository.js';
import type {
  LoginResult,
  PlatformUserRecord,
  SessionUser,
  UserRecord,
  UserRole
} from '../types/User.js';
import { isPlatformRole } from '../auth/permissions.js';
import type { PermissionKey } from '../auth/permissionCatalog.js';
import { resolveUserPermissions } from '../auth/rolePermissions.js';
import { DomainError } from '../utils/errors.js';

// Fixed bcrypt hash (cost 12) of a throwaway value, generated at module load. Compared against
// on any not-found login path so a bcrypt.compare always runs and timing stays constant
// regardless of whether the email matched a platform user, a school user, or nobody.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('perl-dummy-password-for-timing-parity', 12);

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  currentPassword?: string;
  newPassword?: string;
}

const normalizeRequiredString = (value: string, field: string) => {
  const normalized = value.trim();

  if (!normalized) {
    throw new DomainError(`${field} is required.`);
  }

  return normalized;
};

export class AuthService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly platformUserRepository: IPlatformUserRepository
  ) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const platformUser = await this.platformUserRepository.findByEmail(email);

    if (platformUser) {
      const passwordMatches = await bcrypt.compare(password, platformUser.passwordHash);

      if (!passwordMatches) {
        throw new DomainError('Invalid credentials.', 401);
      }

      return {
        user: this.toPlatformSessionUser(platformUser)
      };
    }

    const user = await this.userRepository.findByEmail(email);
    const passwordMatches = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_PASSWORD_HASH);

    if (!user || !passwordMatches) {
      throw new DomainError('Invalid credentials.', 401);
    }

    return {
      user: this.toSessionUser(user)
    };
  }

  async getSessionUser(userId: string): Promise<SessionUser | null> {
    const user = await this.userRepository.findById(userId);

    if (user && user.isActive) {
      return this.toSessionUser(user);
    }

    const platformUser = await this.platformUserRepository.findById(userId);
    return platformUser ? this.toPlatformSessionUser(platformUser) : null;
  }

  async updateProfile(currentUser: SessionUser, input: UpdateProfileInput): Promise<SessionUser> {
    const firstName =
      input.firstName !== undefined ? normalizeRequiredString(input.firstName, 'First name') : undefined;
    const lastName =
      input.lastName !== undefined ? normalizeRequiredString(input.lastName, 'Last name') : undefined;
    const passwordHash =
      input.newPassword !== undefined ? await this.assertPasswordChange(currentUser, input) : undefined;

    const changes = {
      ...(firstName !== undefined ? { firstName } : {}),
      ...(lastName !== undefined ? { lastName } : {}),
      ...(passwordHash !== undefined ? { passwordHash } : {})
    };

    if (isPlatformRole(currentUser.role)) {
      const updated = await this.platformUserRepository.updateProfile(currentUser.id, changes);

      if (!updated) {
        throw new DomainError('User not found.', 404);
      }

      return this.toPlatformSessionUser(updated);
    }

    if (!currentUser.schoolId) {
      throw new DomainError('User not found.', 404);
    }

    const updated = await this.userRepository.update(currentUser.id, currentUser.schoolId, changes);

    if (!updated) {
      throw new DomainError('User not found.', 404);
    }

    return this.toSessionUser(updated);
  }

  private async assertPasswordChange(currentUser: SessionUser, input: UpdateProfileInput): Promise<string> {
    if (!input.currentPassword) {
      throw new DomainError('Current password is required to set a new password.');
    }

    const newPassword = normalizeRequiredString(input.newPassword ?? '', 'New password');
    if (newPassword.length < 8) {
      throw new DomainError('New password must be at least 8 characters.');
    }

    const existingHash = isPlatformRole(currentUser.role)
      ? (await this.platformUserRepository.findById(currentUser.id))?.passwordHash
      : (await this.userRepository.findById(currentUser.id))?.passwordHash;

    if (!existingHash || !(await bcrypt.compare(input.currentPassword, existingHash))) {
      throw new DomainError('Current password is incorrect.', 401);
    }

    return bcrypt.hash(newPassword, 12);
  }

  assertRoleAccess(user: SessionUser, allowedRoles: UserRole[], schoolId: string) {
    if (!allowedRoles.includes(user.role)) {
      throw new DomainError('Forbidden', 403);
    }

    if (!isPlatformRole(user.role) && user.schoolId !== schoolId) {
      throw new DomainError('Forbidden', 403);
    }
  }

  // Permission-catalog counterpart to assertRoleAccess: resolves the user's
  // effective permission set (custom RoleDefinition if assigned, else base-role
  // defaults) instead of checking membership in a fixed role list. SYSTEM_ADMIN/
  // SUPPORT resolve via their hardcoded platform permission sets, unchanged.
  async assertPermissionAccess(
    user: SessionUser,
    roleRepository: IRoleRepository,
    permission: PermissionKey,
    schoolId: string
  ) {
    const permissions = await resolveUserPermissions(user, roleRepository);

    if (!permissions.includes(permission)) {
      throw new DomainError('Forbidden', 403);
    }

    if (!isPlatformRole(user.role) && user.schoolId !== schoolId) {
      throw new DomainError('Forbidden', 403);
    }
  }

  private toSessionUser(user: UserRecord): SessionUser {
    return {
      id: user.id,
      schoolId: user.schoolId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      roleDefinitionId: user.roleDefinitionId ?? null
    };
  }

  private toPlatformSessionUser(user: PlatformUserRecord): SessionUser {
    return {
      id: user.id,
      schoolId: null,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role
    };
  }
}
