import request from 'supertest';
import { createApp } from '../src/app.js';
import { createRepositories, describeForDataLayers } from './helpers/dataLayer.js';

describeForDataLayers('Public enrollment/inquiry intake routes', (dataLayer) => {
  it('returns the intake shape for a known school with features enabled', async () => {
    const app = createApp(createRepositories(dataLayer));

    const response = await request(app).get('/api/public/schools/st-marys/intake');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      school: {
        name: "St. Mary's Academy",
        logoUrl: expect.any(String),
        theme: {
          primaryColor: expect.any(String),
          secondaryColor: expect.any(String),
          accentColor: expect.any(String)
        }
      },
      enrollmentEnabled: true,
      inquiryEnabled: true
    });
    expect(JSON.stringify(response.body)).not.toContain('contactEmail');
    expect(JSON.stringify(response.body)).not.toContain('"id"');
  });

  it('404s the intake page for an unknown slug', async () => {
    const app = createApp(createRepositories(dataLayer));

    const response = await request(app).get('/api/public/schools/does-not-exist/intake');

    expect(response.status).toBe(404);
  });

  it('accepts a public enrollment submission and persists it for the admin to see', async () => {
    const app = createApp(createRepositories(dataLayer));

    const response = await request(app).post('/api/public/schools/st-marys/enrollment').send({
      firstName: 'Public',
      lastName: 'Applicant',
      email: 'public.applicant@example.com',
      gradeLevelApplying: 'Grade 6'
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ message: 'Submission received.' });

    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'admin@stmarys.edu',
      password: 'Password123!'
    });
    const cookie = loginResponse.headers['set-cookie'][0];

    const list = await request(app)
      .get('/api/admin/schools/school-st-marys/submissions')
      .set('Cookie', cookie);
    expect(list.body.submissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          email: 'public.applicant@example.com',
          source: 'PUBLIC',
          status: 'NEW',
          type: 'ENROLLMENT'
        })
      ])
    );
  });

  it('accepts a public inquiry submission', async () => {
    const app = createApp(createRepositories(dataLayer));

    const response = await request(app).post('/api/public/schools/st-marys/inquiry').send({
      firstName: 'Curious',
      lastName: 'Parent',
      email: 'curious.parent@example.com',
      message: 'What time does the office open?'
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ message: 'Submission received.' });
  });

  it('404s a public submission when the feature is disabled for the school', async () => {
    const app = createApp(createRepositories(dataLayer));

    const response = await request(app).post('/api/public/schools/golden-harvest/inquiry').send({
      firstName: 'Blocked',
      lastName: 'Visitor',
      email: 'blocked@example.com',
      message: 'Feature is off.'
    });

    expect(response.status).toBe(404);
  });

  it('404s a public submission for an unknown school slug', async () => {
    const app = createApp(createRepositories(dataLayer));

    const response = await request(app).post('/api/public/schools/does-not-exist/enrollment').send({
      firstName: 'Ghost',
      lastName: 'School',
      email: 'ghost@example.com',
      gradeLevelApplying: 'Grade 1'
    });

    expect(response.status).toBe(404);
  });

  it('silently drops a submission when the honeypot field is filled', async () => {
    const app = createApp(createRepositories(dataLayer));

    const response = await request(app).post('/api/public/schools/st-marys/inquiry').send({
      firstName: 'Bot',
      lastName: 'Spam',
      email: 'bot@example.com',
      message: 'buy now',
      website: 'https://spam.example.com'
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ message: 'Submission received.' });

    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'admin@stmarys.edu',
      password: 'Password123!'
    });
    const cookie = loginResponse.headers['set-cookie'][0];

    const list = await request(app)
      .get('/api/admin/schools/school-st-marys/submissions')
      .set('Cookie', cookie);
    expect(list.body.submissions).toEqual([]);
  });

  it('rejects a submission missing required fields with a validation error', async () => {
    const app = createApp(createRepositories(dataLayer));

    const response = await request(app).post('/api/public/schools/st-marys/enrollment').send({
      firstName: 'Missing',
      lastName: 'Grade',
      email: 'missing.grade@example.com'
    });

    expect(response.status).toBe(400);
  });

  it('rate limits repeated public submissions from the same source', async () => {
    const app = createApp(createRepositories(dataLayer));

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await request(app)
        .post('/api/public/schools/st-marys/inquiry')
        .send({
          firstName: 'Rate',
          lastName: `Limit${attempt}`,
          email: `rate.limit.${attempt}@example.com`,
          message: 'Testing the rate limiter.'
        });
      expect(response.status).toBe(201);
    }

    const throttled = await request(app).post('/api/public/schools/st-marys/inquiry').send({
      firstName: 'Rate',
      lastName: 'Overflow',
      email: 'rate.overflow@example.com',
      message: 'This one should be throttled.'
    });

    expect(throttled.status).toBe(429);
    expect(throttled.headers['retry-after']).toEqual(expect.any(String));
  }, 20_000);
});
