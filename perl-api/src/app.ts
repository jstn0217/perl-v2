import cookieParser from 'cookie-parser';
import express from 'express';
import { env } from './config/env.js';
import { createAdminRoutes } from './routes/adminRoutes.js';
import { createAuthRoutes } from './routes/authRoutes.js';
import { createHealthRoutes } from './routes/healthRoutes.js';
import { createSchoolRoutes } from './routes/schoolRoutes.js';
import type { RepositorySet } from './repositories/index.js';

export const createApp = (repositories: RepositorySet) => {
  const app = express();

  app.use((req, res, next) => {
    const requestOrigin = req.headers.origin;

    if (requestOrigin && env.allowedOrigins.includes(requestOrigin)) {
      res.header('Access-Control-Allow-Origin', requestOrigin);
      res.header('Vary', 'Origin');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    }

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    next();
  });
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', createAuthRoutes(repositories));
  app.use('/api', createHealthRoutes(repositories));
  app.use('/api', createSchoolRoutes(repositories));
  app.use('/api', createAdminRoutes(repositories));

  return app;
};
