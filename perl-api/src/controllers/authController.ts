import type { Request, Response } from 'express';
import { createSessionToken } from '../auth/session.js';
import { env } from '../config/env.js';
import type { RepositorySet } from '../repositories/index.js';
import { AuthService } from '../services/AuthService.js';
import { TenantService } from '../services/TenantService.js';

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
  const authService = new AuthService(repositories.userRepository);
  const tenantService = new TenantService(repositories.tenantRepository);

  return {
    async login(req: Request, res: Response) {
      const { email, password } = req.body as {
        email?: string;
        password?: string;
      };
      const requestedSlug = typeof req.body?.schoolSlug === 'string' ? req.body.schoolSlug : undefined;
      const school = await tenantService.getCurrentSchool(requestedSlug);

      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
      }

      try {
        const { user } = await authService.login(email, password, school.id);
        const token = createSessionToken(user);

        setSessionCookie(res, token);
        return res.json({ user, school });
      } catch {
        return res.status(401).json({ message: 'Invalid credentials.' });
      }
    },

    async logout(_req: Request, res: Response) {
      clearSessionCookie(res);
      return res.status(204).send();
    },

    async getSession(req: Request, res: Response) {
      if (!req.currentUser) {
        return res.json({ authenticated: false, user: null });
      }

      return res.json({ authenticated: true, user: req.currentUser });
    }
  };
};
