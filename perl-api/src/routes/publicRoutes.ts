import { Router } from 'express';
import type { RepositorySet } from '../repositories/index.js';
import { createPublicController } from '../controllers/publicController.js';
import { createRateLimiter, resolvePublicSubmissionRateLimitKey } from '../middleware/rateLimitMiddleware.js';

const PUBLIC_SUBMISSION_WINDOW_MS = 60 * 60 * 1000;
const PUBLIC_SUBMISSION_MAX_ATTEMPTS = 10;

export const createPublicRoutes = (repositories: RepositorySet) => {
  const router = Router();
  const controller = createPublicController(repositories);
  const submissionRateLimiter = createRateLimiter({
    windowMs: PUBLIC_SUBMISSION_WINDOW_MS,
    maxRequests: PUBLIC_SUBMISSION_MAX_ATTEMPTS,
    key: resolvePublicSubmissionRateLimitKey,
    message: 'Too many submissions from this network. Please try again later.'
  });

  router.get('/public/schools/:slug/intake', controller.getIntake);
  router.post('/public/schools/:slug/enrollment', submissionRateLimiter, controller.createEnrollment);
  router.post('/public/schools/:slug/inquiry', submissionRateLimiter, controller.createInquiry);

  return router;
};
