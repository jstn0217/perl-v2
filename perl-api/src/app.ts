import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { createAttendanceRoutes } from './routes/attendanceRoutes.js';
import { createAdminRoutes } from './routes/adminRoutes.js';
import { createAuthRoutes } from './routes/authRoutes.js';
import { createHealthRoutes } from './routes/healthRoutes.js';
import { createSchoolRoutes } from './routes/schoolRoutes.js';
import { createSupportRoutes } from './routes/supportRoutes.js';
import type { RepositorySet } from './repositories/index.js';
import { createImageStorage, type IImageStorage } from './storage/index.js';
import { createSmsGateway, type ISmsGateway } from './notifications/index.js';

export const createApp = (
  repositories: RepositorySet,
  imageStorage: IImageStorage = createImageStorage(),
  smsGateway: ISmsGateway = createSmsGateway()
) => {
  const app = express();

  app.use(helmet());

  app.use((req, res, next) => {
    const requestOrigin = req.headers.origin;

    if (requestOrigin && env.allowedOrigins.includes(requestOrigin)) {
      res.header('Access-Control-Allow-Origin', requestOrigin);
      res.header('Vary', 'Origin');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Headers', 'Content-Type, X-Device-Key');
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
  app.use('/api', createAttendanceRoutes(repositories, smsGateway));
  app.use('/api', createHealthRoutes(repositories));
  app.use('/api', createSchoolRoutes(repositories));
  app.use('/api', createAdminRoutes(repositories, imageStorage));
  app.use('/api', createSupportRoutes(repositories));

  app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) {
      return next(err);
    }

    console.error('Unhandled request error:', err);
    res.status(500).json({ message: 'Internal server error.' });
  });

  return app;
};
