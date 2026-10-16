import type { NextFunction, Request, Response } from 'express';
import type { AuthService } from '../services/AuthService.js';
import { env } from '../config/env.js';
import { verifySessionToken } from '../auth/session.js';
import type { UserRole } from '../types/User.js';
import type { IRoleRepository } from '../repositories/interfaces/IRoleRepository.js';
import type { PermissionKey } from '../auth/permissionCatalog.js';

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

      if (
        user &&
        user.schoolId === payload.schoolId &&
        user.role === payload.role
      ) {
        req.currentUser = {
          ...user,
          schoolId: payload.schoolId,
          role: payload.role
        };
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
      return res.status(401).json({ message: 'Authentication required.' });
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

// Permission-catalog counterpart to requireRole: instead of checking the
// caller's raw role against a fixed list, it resolves their effective
// permission set (custom RoleDefinition or base-role default) and checks for
// a single catalog key. School-scoping works the same way requireRole does.
export const requirePermission =
  (authService: AuthService, roleRepository: IRoleRepository, permission: PermissionKey) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.currentUser) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const schoolId = typeof req.params.schoolId === 'string' ? req.params.schoolId : undefined;

    if (!schoolId) {
      return res.status(400).json({ message: 'School scope is required.' });
    }

    authService
      .assertPermissionAccess(req.currentUser, roleRepository, permission, schoolId)
      .then(() => next())
      .catch(() => res.status(403).json({ message: 'Forbidden.' }));
  };

export const requireUserRole =
  (allowedRoles: UserRole[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.currentUser) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    if (!allowedRoles.includes(req.currentUser.role)) {
      return res.status(403).json({ message: 'Forbidden.' });
    }

    next();
  };
