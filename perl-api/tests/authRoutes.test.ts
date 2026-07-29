import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { createRepositories, describeForDataLayers } from './helpers/dataLayer.js';

describeForDataLayers('Phase 2 auth routes', (dataLayer) => {
  it('sets a session cookie on successful login', async () => {
    const app = createApp(createRepositories(dataLayer));

    const response = await request(app).post('/api/auth/login').send({
      email: 'admin@stmarys.edu',
      password: 'Password123!',
      schoolSlug: 'riverside-tech'
    });

    expect(response.status).toBe(200);
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('perl_session=')])
    );
    expect(response.body.user).toMatchObject({
      email: 'admin@stmarys.edu',
      schoolId: 'school-st-marys',
      role: 'ADMIN'
    });
    expect(response.body.school.id).toBe('school-st-marys');
    const token = response.headers['set-cookie'][0]
      .split(';')[0]
      .slice(`${env.jwtCookieName}=`.length);
    expect(jwt.verify(token, env.jwtSecret)).toMatchObject({
      schoolId: 'school-st-marys',
      role: 'ADMIN'
    });
  });

  it('returns the current session when the cookie is valid', async () => {
    const app = createApp(createRepositories(dataLayer));
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'admin@stmarys.edu',
      password: 'Password123!',
      schoolSlug: 'st-marys'
    });
    const cookie = loginResponse.headers['set-cookie'][0];

    const sessionResponse = await request(app).get('/api/auth/session').set('Cookie', cookie);

    expect(sessionResponse.status).toBe(200);
    expect(sessionResponse.body).toMatchObject({
      authenticated: true,
      user: {
        schoolId: 'school-st-marys',
        role: 'ADMIN'
      }
    });
  });

  it('authenticates system-admin and support accounts without binding either to one school', async () => {
    const app = createApp(createRepositories(dataLayer));

    const systemAdminResponse = await request(app).post('/api/auth/login').send({
      email: 'system@perl.system',
      password: 'SystemAdmin123!'
    });
    const supportResponse = await request(app).post('/api/auth/login').send({
      email: 'support@perl.system',
      password: 'Support123!'
    });

    expect(systemAdminResponse.status).toBe(200);
    expect(systemAdminResponse.body.user).toMatchObject({
      email: 'system@perl.system',
      schoolId: null,
      role: 'SYSTEM_ADMIN'
    });
    expect(supportResponse.status).toBe(200);
    expect(supportResponse.body.user).toMatchObject({
      email: 'support@perl.system',
      schoolId: null,
      role: 'SUPPORT'
    });
  });

  it('allows platform users to read any school while keeping school admins tenant-bound', async () => {
    const app = createApp(createRepositories(dataLayer));
    const supportLogin = await request(app).post('/api/auth/login').send({
      email: 'support@perl.system',
      password: 'Support123!',
      schoolSlug: 'st-marys'
    });
    const supportCookie = supportLogin.headers['set-cookie'][0];

    const supportResponse = await request(app)
      .get('/api/admin/schools/school-riverside/summary')
      .set('Cookie', supportCookie);

    expect(supportResponse.status).toBe(200);
    expect(supportResponse.body.school.id).toBe('school-riverside');

    const schoolAdminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@stmarys.edu',
      password: 'Password123!',
      schoolSlug: 'st-marys'
    });
    const schoolAdminCookie = schoolAdminLogin.headers['set-cookie'][0];
    const globalLogResponse = await request(app)
      .get('/api/support/audit-logs')
      .set('Cookie', schoolAdminCookie);

    expect(globalLogResponse.status).toBe(403);
  });

  it('rejects unauthenticated access to admin routes', async () => {
    const app = createApp(createRepositories(dataLayer));

    const response = await request(app).get('/api/admin/schools/school-st-marys/summary');

    expect(response.status).toBe(401);
  });

  it('rejects a signed token whose tenant claim no longer matches its account', async () => {
    const app = createApp(createRepositories(dataLayer));
    const mismatchedToken = jwt.sign(
      {
        schoolId: 'school-riverside',
        role: 'ADMIN'
      },
      env.jwtSecret,
      {
        subject: 'user-stmarys-admin',
        expiresIn: 60
      }
    );

    const response = await request(app)
      .get('/api/auth/session')
      .set('Cookie', `${env.jwtCookieName}=${mismatchedToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ authenticated: false, user: null });
  });

  it('forbids cross-school access for an authenticated admin from another school', async () => {
    const app = createApp(createRepositories(dataLayer));
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'admin@stmarys.edu',
      password: 'Password123!',
      schoolSlug: 'st-marys'
    });
    const cookie = loginResponse.headers['set-cookie'][0];

    const response = await request(app)
      .get('/api/admin/schools/school-riverside/summary')
      .set('Cookie', cookie);

    expect(response.status).toBe(403);
  });

  it('forbids non-admin users from the same school on admin routes', async () => {
    const app = createApp(createRepositories(dataLayer));
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'staff@stmarys.edu',
      password: 'Password123!',
      schoolSlug: 'st-marys'
    });
    const cookie = loginResponse.headers['set-cookie'][0];

    const response = await request(app)
      .get('/api/admin/schools/school-st-marys/summary')
      .set('Cookie', cookie);

    expect(response.status).toBe(403);
  });

  it('rejects an expired session token on protected routes', async () => {
    const app = createApp(createRepositories(dataLayer));
    const expiredToken = jwt.sign(
      {
        schoolId: 'school-st-marys',
        role: 'ADMIN'
      },
      env.jwtSecret,
      {
        subject: 'user-stmarys-admin',
        expiresIn: -1
      }
    );

    const response = await request(app)
      .get('/api/admin/schools/school-st-marys/summary')
      .set('Cookie', `${env.jwtCookieName}=${expiredToken}`);

    expect(response.status).toBe(401);
  });

  it('rate limits repeated login attempts from the same client and email', async () => {
    const app = createApp(createRepositories(dataLayer));

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', `203.0.113.${attempt + 1}`)
        .send({
          email: 'admin@stmarys.edu',
          password: 'WrongPassword!',
          schoolSlug: 'st-marys'
        });

      expect(response.status).toBe(401);
    }

    const throttledResponse = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '203.0.113.250')
      .send({
        email: 'admin@stmarys.edu',
        password: 'WrongPassword!',
        schoolSlug: 'st-marys'
      });

    expect(throttledResponse.status).toBe(429);
    expect(throttledResponse.body.message).toBe('Too many login attempts. Please try again later.');
    expect(throttledResponse.headers['retry-after']).toEqual(expect.any(String));
  });

  it('responds to allowed-origin CORS preflight requests without opening wildcard access', async () => {
    const app = createApp(createRepositories(dataLayer));

    const allowedResponse = await request(app)
      .options('/api/auth/login')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST');

    expect(allowedResponse.status).toBe(204);
    expect(allowedResponse.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(allowedResponse.headers['access-control-allow-credentials']).toBe('true');

    const disallowedResponse = await request(app)
      .options('/api/auth/login')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST');

    expect(disallowedResponse.status).toBe(204);
    expect(disallowedResponse.headers['access-control-allow-origin']).toBeUndefined();
  });
});
