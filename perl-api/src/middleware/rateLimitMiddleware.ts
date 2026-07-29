import { createHash } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

interface RateLimitOptions {
  message: string;
  maxRequests: number;
  windowMs: number;
  key: (req: Request) => string;
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitStores = new Set<Map<string, RateLimitEntry>>();

const getClientAddress = (req: Request) => {
  return req.ip || req.socket.remoteAddress || 'unknown';
};

const hashCredential = (value: string) => {
  return createHash('sha256').update(value).digest('hex');
};

export const resetRateLimiters = () => {
  for (const store of rateLimitStores) {
    store.clear();
  }
};

export const createRateLimiter = ({ key, maxRequests, message, windowMs }: RateLimitOptions) => {
  const store = new Map<string, RateLimitEntry>();
  rateLimitStores.add(store);

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const identifier = key(req);
    const entry = store.get(identifier);

    if (!entry || now - entry.windowStart >= windowMs) {
      store.set(identifier, {
        count: 1,
        windowStart: now
      });

      return next();
    }

    if (entry.count >= maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - entry.windowStart)) / 1000));

      res.setHeader('Retry-After', `${retryAfterSeconds}`);
      return res.status(429).json({ message });
    }

    entry.count += 1;
    store.set(identifier, entry);

    next();
  };
};

export const resolveLoginRateLimitKey = (req: Request) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : 'unknown-email';

  return `login:${getClientAddress(req)}:${email}`;
};

export const resolveDeviceScanRateLimitKey = (req: Request) => {
  const deviceKey = req.header('x-device-key')?.trim();
  if (deviceKey) {
    return `scan-device:${hashCredential(deviceKey)}`;
  }

  return `scan-browser:${getClientAddress(req)}`;
};
