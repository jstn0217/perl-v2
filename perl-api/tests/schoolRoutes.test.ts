import request from 'supertest';
import { createApp } from '../src/app.js';
import { createRepositories, describeForDataLayers } from './helpers/dataLayer.js';

describeForDataLayers('GET /api/school/current', (dataLayer) => {
  it('does not expose the client list publicly and derives the school from the session', async () => {
    const app = createApp(createRepositories(dataLayer));

    const publicResponse = await request(app).get('/api/school/current');
    expect(publicResponse.status).toBe(401);

    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'admin@riversidetech.edu',
      password: 'Password123!'
    });
    const response = await request(app)
      .get('/api/school/current?school=st-marys')
      .set('Cookie', loginResponse.headers['set-cookie'][0]);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      school: {
        slug: 'riverside-tech',
        name: 'Riverside Technical Institute'
      }
    });
    expect(response.body.schools).toBeUndefined();
  });
});
