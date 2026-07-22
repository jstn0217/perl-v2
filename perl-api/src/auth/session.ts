import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { SessionUser, UserRole } from '../types/User.js';

interface SessionTokenPayload {
  sub: string;
  schoolId: string;
  role: UserRole;
}

export const createSessionToken = (user: SessionUser) => {
  return jwt.sign(
    {
      schoolId: user.schoolId,
      role: user.role
    } satisfies Omit<SessionTokenPayload, 'sub'>,
    env.jwtSecret,
    {
      subject: user.id,
      expiresIn: env.jwtExpiresInSeconds
    }
  );
};

export const verifySessionToken = (token: string): SessionTokenPayload => {
  const payload = jwt.verify(token, env.jwtSecret);

  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Invalid session token payload.');
  }

  const { sub, schoolId, role } = payload as Partial<SessionTokenPayload>;

  if (!sub || !schoolId || !role) {
    throw new Error('Session token payload is incomplete.');
  }

  return {
    sub,
    schoolId,
    role
  };
};
