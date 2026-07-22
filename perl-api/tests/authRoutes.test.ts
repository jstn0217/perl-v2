import request from 'supertest';
import { createApp } from '../src/app.js';
import { createRepositories } from '../src/repositories/index.js';

describe('Phase 2 auth routes', () => {
  it('sets a session cookie on successful login', async () => {
    const app = createApp(createRepositories('mock'));

    const response = await request(app).post('/api/auth/login').send({
      email: 'admin@demo.edu',
      password: 'Password123!',
      schoolSlug: 'st-marys'
    });

    expect(response.status).toBe(200);
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('perl_session=')])
    );
    expect(response.body.user).toMatchObject({
      email: 'admin@demo.edu',
      schoolId: 'school-st-marys',
      role: 'ADMIN'
    });
  });

  it('returns the current session when the cookie is valid', async () => {
    const app = createApp(createRepositories('mock'));
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'admin@demo.edu',
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

  it('rejects unauthenticated access to admin routes', async () => {
    const app = createApp(createRepositories('mock'));

    const response = await request(app).get('/api/admin/schools/school-st-marys/summary');

    expect(response.status).toBe(401);
  });

  it('forbids cross-school access for an authenticated admin from another school', async () => {
    const app = createApp(createRepositories('mock'));
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'admin@demo.edu',
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
    const app = createApp(createRepositories('mock'));
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
});
