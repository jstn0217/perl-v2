import request from 'supertest';
import { createApp } from '../src/app.js';
import { createRepositories } from '../src/repositories/index.js';

describe('GET /api/school/current', () => {
  it('returns the resolved school and the demo school list in one payload', async () => {
    const app = createApp(createRepositories('mock'));

    const response = await request(app).get('/api/school/current?school=riverside-tech');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      school: {
        slug: 'riverside-tech',
        name: 'Riverside Technical Institute'
      }
    });
    expect(response.body.schools).toHaveLength(3);
    expect(response.body.schools.map((school: { slug: string }) => school.slug)).toEqual([
      'st-marys',
      'riverside-tech',
      'golden-harvest'
    ]);
  });
});
