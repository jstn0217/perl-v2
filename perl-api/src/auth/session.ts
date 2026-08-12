import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import type { SessionUser, UserRole } from '../types/User.js';

interface SessionTokenPayload {
  sub: string;
  schoolId: string | null;
  role: UserRole;
  jti: string;
}

// In-memory revocation store, keyed by jti, valued by the token's expiry (epoch seconds).
// Single-process only: a multi-instance deployment needs a shared store (e.g. Redis) instead.
const revokedTokenExpiryByJti = new Map<string, number>();

const pruneExpiredRevocations = () => {
  const nowSeconds = Date.now() / 1000;

  for (const [jti, expiresAt] of revokedTokenExpiryByJti) {
    if (expiresAt <= nowSeconds) {
      revokedTokenExpiryByJti.delete(jti);
    }
  }
};

export const createSessionToken = (user: SessionUser) => {
  return jwt.sign(
    {
      schoolId: user.schoolId,
      role: user.role,
      jti: randomUUID()
    } satisfies Omit<SessionTokenPayload, 'sub'>,
    env.jwtSecret,
    {
      subject: user.id,
      expiresIn: env.jwtExpiresInSeconds,
      algorithm: 'HS256'
    }
  );
};

export const verifySessionToken = (token: string): SessionTokenPayload => {
  const payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });

  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Invalid session token payload.');
  }

  const { sub, schoolId, role, jti } = payload as Partial<SessionTokenPayload>;

  if (!sub || schoolId === undefined || !role || !jti) {
    throw new Error('Session token payload is incomplete.');
  }

  pruneExpiredRevocations();

  if (revokedTokenExpiryByJti.has(jti)) {
    throw new Error('Session token has been revoked.');
  }

  return {
    sub,
    schoolId,
    role,
    jti
  };
};

export const revokeSessionToken = (token: string) => {
  const decoded = jwt.decode(token);

  if (typeof decoded !== 'object' || decoded === null) {
    return;
  }

  const { jti, exp } = decoded as Partial<SessionTokenPayload> & { exp?: number };

  if (!jti || !exp) {
    return;
  }

  pruneExpiredRevocations();
  revokedTokenExpiryByJti.set(jti, exp);
};
