import type { NextFunction, Request, Response } from 'express';
import type { AuthService } from '../services/AuthService.js';
import { env } from '../config/env.js';
import { verifySessionToken } from '../auth/session.js';
import type { UserRole } from '../types/User.js';

const getTokenFromRequest = (req: Request) => {
  const token = req.cookies?.[env.jwtCookieName];

  return typeof token === 'string' && token.length > 0 ? token : null;
};

export const attachSessionUser =
  (authService: AuthService) => async (req: Request, _res: Response, next: NextFunction) => {
    const token = getTokenFromRequest(req);

    if (!token) {
      return next();
    }

    try {
      const payload = verifySessionToken(token);
      const user = await authService.getSessionUser(payload.sub);

      if (user) {
        req.currentUser = user;
      }
    } catch {
      req.currentUser = undefined;
    }

    next();
  };

export const requireAuth =
  (authService: AuthService) => async (req: Request, res: Response, next: NextFunction) => {
    await attachSessionUser(authService)(req, res, () => undefined);

    if (!req.currentUser) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    next();
  };

export const requireRole =
  (authService: AuthService, allowedRoles: UserRole[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.currentUser) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const schoolId = typeof req.params.schoolId === 'string' ? req.params.schoolId : undefined;

    if (!schoolId) {
      return res.status(400).json({ message: 'School scope is required.' });
    }

    try {
      authService.assertRoleAccess(req.currentUser, allowedRoles, schoolId);
      next();
    } catch {
      return res.status(403).json({ message: 'Forbidden.' });
    }
  };
