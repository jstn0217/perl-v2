import bcrypt from 'bcrypt';
import type { IUserRepository } from '../repositories/interfaces/IUserRepository.js';
import type { LoginResult, SessionUser, UserRecord, UserRole } from '../types/User.js';

export class AuthService {
  constructor(private readonly userRepository: IUserRepository) {}

  async login(email: string, password: string, schoolId: string): Promise<LoginResult> {
    const user = await this.userRepository.findByEmailAndSchool(email, schoolId);

    if (!user) {
      throw new Error('Invalid credentials.');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      throw new Error('Invalid credentials.');
    }

    return {
      user: this.toSessionUser(user)
    };
  }

  async getSessionUser(userId: string): Promise<SessionUser | null> {
    const user = await this.userRepository.findById(userId);

    return user ? this.toSessionUser(user) : null;
  }

  assertRoleAccess(user: SessionUser, allowedRoles: UserRole[], schoolId: string) {
    if (user.schoolId !== schoolId) {
      throw new Error('Forbidden');
    }

    if (!allowedRoles.includes(user.role)) {
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
}
