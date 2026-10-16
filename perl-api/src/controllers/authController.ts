import type { Request, Response } from 'express';
import { createSessionToken, revokeSessionToken } from '../auth/session.js';
import { env } from '../config/env.js';
import type { RepositorySet } from '../repositories/index.js';
import { AuthService } from '../services/AuthService.js';
import { TenantService } from '../services/TenantService.js';
import { handleControllerError } from '../utils/errors.js';

const setSessionCookie = (res: Response, token: string) => {
  res.cookie(env.jwtCookieName, token, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'lax',
    maxAge: env.jwtExpiresInSeconds * 1000
  });
};

const clearSessionCookie = (res: Response) => {
  res.clearCookie(env.jwtCookieName, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'lax'
  });
};

export const createAuthController = (repositories: RepositorySet) => {
  const authService = new AuthService(
    repositories.userRepository,
    repositories.platformUserRepository
  );
  const tenantService = new TenantService(repositories.tenantRepository);

  return {
    async login(req: Request, res: Response) {
      const { email, password } = req.body as {
        email?: string;
        password?: string;
      };
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
      }

      try {
        const { user } = await authService.login(email, password);
        const token = createSessionToken(user);
        const school = user.schoolId
          ? await tenantService.getSchoolById(user.schoolId)
          : null;

        setSessionCookie(res, token);
        return res.json({ user, school });
      } catch {
        return res.status(401).json({ message: 'Invalid credentials.' });
      }
    },

    async logout(req: Request, res: Response) {
      const token = req.cookies?.[env.jwtCookieName];
      if (typeof token === 'string' && token.length > 0) {
        revokeSessionToken(token);
      }
      clearSessionCookie(res);
      return res.status(204).send();
    },

    async getSession(req: Request, res: Response) {
      if (!req.currentUser) {
        return res.json({ authenticated: false, user: null });
      }

      const school = req.currentUser.schoolId
        ? await tenantService.getSchoolById(req.currentUser.schoolId)
        : null;
      return res.json({ authenticated: true, user: req.currentUser, school });
    },

    async updateProfile(req: Request, res: Response) {
      const currentUser = req.currentUser as NonNullable<Request['currentUser']>;
      const { firstName, lastName, currentPassword, newPassword } = req.body as {
        firstName?: string;
        lastName?: string;
        currentPassword?: string;
        newPassword?: string;
      };

      try {
        const user = await authService.updateProfile(currentUser, {
          firstName,
          lastName,
          currentPassword,
          newPassword
        });

        return res.json({ user });
      } catch (error) {
        return handleControllerError(res, error, 'authController.updateProfile');
      }
    }
  };
};
