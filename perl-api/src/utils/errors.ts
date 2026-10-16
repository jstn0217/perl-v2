import type { Response } from 'express';

/**
 * A known, intentional error safe to forward to the client (validation
 * failures, "not found", permission denials, etc). Services throw this
 * instead of a plain Error when the message is meant to be user-facing.
 * Anything else thrown (a bug, a driver error, a network failure) is treated
 * as unexpected and must never reach the client verbatim.
 */
export class DomainError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400, options?: ErrorOptions) {
    super(message, options);
    this.name = 'DomainError';
    this.statusCode = statusCode;
  }
}

/**
 * Standard controller catch-block handler: forwards DomainError messages and
 * status codes as-is, logs anything else server-side, and returns a generic
 * body so unexpected errors (stack traces, driver messages, internal detail)
 * never leak to the client.
 */
export const handleControllerError = (res: Response, error: unknown, context: string): Response => {
  if (error instanceof DomainError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  console.error(`[${context}]`, error);
  return res.status(500).json({ error: 'Internal server error' });
};
