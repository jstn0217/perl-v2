import type { SessionUser } from './User.js';

declare global {
  namespace Express {
    interface Request {
      currentUser?: SessionUser;
    }
  }
}

export {};
