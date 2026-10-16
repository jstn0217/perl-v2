import request from 'supertest';
import { createApp } from '../src/app.js';
import { createRepositories, describeForDataLayers } from './helpers/dataLayer.js';

const login = async (app: ReturnType<typeof createApp>, email: string, password: string) => {
  const response = await request(app).post('/api/auth/login').send({ email, password });
  return response.headers['set-cookie'][0];
};

describeForDataLayers('Phase: enrollment/inquiry submissions admin routes', (dataLayer) => {
  it('lets a school admin create, list, filter, and update submissions', async () => {
    const app = createApp(createRepositories(dataLayer));
    const cookie = await login(app, 'admin@stmarys.edu', 'Password123!');

    const enrollment = await request(app)
      .post('/api/admin/schools/school-st-marys/submissions')
      .set('Cookie', cookie)
      .send({
        type: 'ENROLLMENT',
        firstName: 'Mia',
        lastName: 'Torres',
        email: 'mia.torres@example.com',
        gradeLevelApplying: 'Grade 4',
        guardianName: 'Rosa Torres'
      });
    expect(enrollment.status).toBe(201);
    expect(enrollment.body.submission).toMatchObject({
      schoolId: 'school-st-marys',
      type: 'ENROLLMENT',
      status: 'NEW',
      source: 'MANUAL',
      firstName: 'Mia',
      lastName: 'Torres',
      email: 'mia.torres@example.com'
    });

    const inquiry = await request(app)
      .post('/api/admin/schools/school-st-marys/submissions')
      .set('Cookie', cookie)
      .send({
        type: 'INQUIRY',
        firstName: 'Leo',
        lastName: 'Bautista',
        email: 'leo.bautista@example.com',
        message: 'What are your tuition rates?'
      });
    expect(inquiry.status).toBe(201);

    const missingType = await request(app)
      .post('/api/admin/schools/school-st-marys/submissions')
      .set('Cookie', cookie)
      .send({ firstName: 'No', lastName: 'Type', email: 'no.type@example.com' });
    expect(missingType.status).toBe(400);

    const listAll = await request(app)
      .get('/api/admin/schools/school-st-marys/submissions')
      .set('Cookie', cookie);
    expect(listAll.status).toBe(200);
    expect(listAll.body.total).toBe(2);
    expect(listAll.body.page).toBe(1);
    expect(listAll.body.pageSize).toBe(20);

    const filteredByType = await request(app)
      .get('/api/admin/schools/school-st-marys/submissions?type=ENROLLMENT')
      .set('Cookie', cookie);
    expect(filteredByType.body.submissions).toHaveLength(1);
    expect(filteredByType.body.submissions[0].type).toBe('ENROLLMENT');

    const filteredBySearch = await request(app)
      .get('/api/admin/schools/school-st-marys/submissions?search=Bautista')
      .set('Cookie', cookie);
    expect(filteredBySearch.body.submissions).toHaveLength(1);
    expect(filteredBySearch.body.submissions[0].lastName).toBe('Bautista');

    const submissionId = enrollment.body.submission.id;
    const update = await request(app)
      .patch(`/api/admin/schools/school-st-marys/submissions/${submissionId}`)
      .set('Cookie', cookie)
      .send({ status: 'IN_REVIEW', notes: 'Called guardian.' });
    expect(update.status).toBe(200);
    expect(update.body.submission).toMatchObject({ status: 'IN_REVIEW', notes: 'Called guardian.' });

    const invalidStatus = await request(app)
      .patch(`/api/admin/schools/school-st-marys/submissions/${submissionId}`)
      .set('Cookie', cookie)
      .send({ status: 'NOT_REAL' });
    expect(invalidStatus.status).toBe(400);

    const notFound = await request(app)
      .patch('/api/admin/schools/school-st-marys/submissions/submission-does-not-exist')
      .set('Cookie', cookie)
      .send({ status: 'ACCEPTED' });
    expect(notFound.status).toBe(404);
  });

  it('manual create does not require the enrollment/inquiry feature toggle to be on', async () => {
    const app = createApp(createRepositories(dataLayer));
    const cookie = await login(app, 'admin@goldenharvest.edu', 'Password123!');

    const response = await request(app)
      .post('/api/admin/schools/school-golden/submissions')
      .set('Cookie', cookie)
      .send({
        type: 'INQUIRY',
        firstName: 'Walk',
        lastName: 'In',
        email: 'walk.in@example.com',
        message: 'Visiting today, feature is off.'
      });

    expect(response.status).toBe(201);
  });

  it('forbids STAFF from reading or writing submissions', async () => {
    const app = createApp(createRepositories(dataLayer));
    const cookie = await login(app, 'staff@stmarys.edu', 'Password123!');

    const list = await request(app)
      .get('/api/admin/schools/school-st-marys/submissions')
      .set('Cookie', cookie);
    expect(list.status).toBe(403);

    const create = await request(app)
      .post('/api/admin/schools/school-st-marys/submissions')
      .set('Cookie', cookie)
      .send({ type: 'INQUIRY', firstName: 'A', lastName: 'B', email: 'a@example.com', message: 'hi' });
    expect(create.status).toBe(403);
  });

  it('blocks cross-school access to submission routes', async () => {
    const app = createApp(createRepositories(dataLayer));
    const cookie = await login(app, 'admin@stmarys.edu', 'Password123!');

    const list = await request(app)
      .get('/api/admin/schools/school-riverside/submissions')
      .set('Cookie', cookie);
    expect(list.status).toBe(403);

    const create = await request(app)
      .post('/api/admin/schools/school-riverside/submissions')
      .set('Cookie', cookie)
      .send({ type: 'INQUIRY', firstName: 'A', lastName: 'B', email: 'a@example.com', message: 'hi' });
    expect(create.status).toBe(403);

    const update = await request(app)
      .patch('/api/admin/schools/school-riverside/submissions/submission-anything')
      .set('Cookie', cookie)
      .send({ status: 'ACCEPTED' });
    expect(update.status).toBe(403);
  });
});
