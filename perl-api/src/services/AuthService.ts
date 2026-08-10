import bcrypt from 'bcrypt';
import type { IUserRepository } from '../repositories/interfaces/IUserRepository.js';
import type { IPlatformUserRepository } from '../repositories/interfaces/IPlatformUserRepository.js';
import type {
  LoginResult,
  PlatformUserRecord,
  SessionUser,
  UserRecord,
  UserRole
} from '../types/User.js';
import { isPlatformRole } from '../auth/permissions.js';

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  currentPassword?: string;
  newPassword?: string;
}

const normalizeRequiredString = (value: string, field: string) => {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${field} is required.`);
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
        throw new Error('Invalid credentials.');
      }

      return {
        user: this.toPlatformSessionUser(platformUser)
      };
    }

    const user = await this.userRepository.findByEmail(email);
    const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false;

    if (!user || !passwordMatches) {
      throw new Error('Invalid credentials.');
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
        throw new Error('User not found.');
      }

      return this.toPlatformSessionUser(updated);
    }

    if (!currentUser.schoolId) {
      throw new Error('User not found.');
    }

    const updated = await this.userRepository.update(currentUser.id, currentUser.schoolId, changes);

    if (!updated) {
      throw new Error('User not found.');
    }

    return this.toSessionUser(updated);
  }

  private async assertPasswordChange(currentUser: SessionUser, input: UpdateProfileInput): Promise<string> {
    if (!input.currentPassword) {
      throw new Error('Current password is required to set a new password.');
    }

    const newPassword = normalizeRequiredString(input.newPassword ?? '', 'New password');
    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters.');
    }

    const existingHash = isPlatformRole(currentUser.role)
      ? (await this.platformUserRepository.findById(currentUser.id))?.passwordHash
      : (await this.userRepository.findById(currentUser.id))?.passwordHash;

    if (!existingHash || !(await bcrypt.compare(input.currentPassword, existingHash))) {
      throw new Error('Current password is incorrect.');
    }

    return bcrypt.hash(newPassword, 10);
  }

  assertRoleAccess(user: SessionUser, allowedRoles: UserRole[], schoolId: string) {
    if (!allowedRoles.includes(user.role)) {
      throw new Error('Forbidden');
    }

    if (!isPlatformRole(user.role) && user.schoolId !== schoolId) {
      throw new Error('Forbidden');
    }
  }

  private toSessionUser(user: UserRecord): SessionUser {
    return {
      id: user.id,
      schoolId: user.schoolId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role
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
