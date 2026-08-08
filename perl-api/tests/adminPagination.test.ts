import request from 'supertest';
import { createApp } from '../src/app.js';
import { createRepositories, describeForDataLayers } from './helpers/dataLayer.js';

describeForDataLayers('Phase 4/5 admin list pagination', (dataLayer) => {
  const loginAsStMarysAdmin = async (app: ReturnType<typeof createApp>) => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'admin@stmarys.edu',
      password: 'Password123!',
      schoolSlug: 'st-marys'
    });
    return loginResponse.headers['set-cookie'][0];
  };

  it('paginates the user list with a stable name sort and correct totals', async () => {
    const app = createApp(createRepositories(dataLayer));
    const cookie = await loginAsStMarysAdmin(app);

    const pageOne = await request(app)
      .get('/api/admin/schools/school-st-marys/users?page=1&pageSize=2')
      .set('Cookie', cookie);
    expect(pageOne.status).toBe(200);
    expect(pageOne.body.total).toBe(4);
    expect(pageOne.body.page).toBe(1);
    expect(pageOne.body.pageSize).toBe(2);
    expect(pageOne.body.users).toHaveLength(2);
    // default sort is name asc (last name, first name): Garcia, Ana then Garcia, Lia
    expect(pageOne.body.users[0]).toMatchObject({ firstName: 'Ana', lastName: 'Garcia' });
    expect(pageOne.body.users[1]).toMatchObject({ firstName: 'Lia', lastName: 'Garcia' });

    const pageTwo = await request(app)
      .get('/api/admin/schools/school-st-marys/users?page=2&pageSize=2')
      .set('Cookie', cookie);
    expect(pageTwo.status).toBe(200);
    expect(pageTwo.body.users).toHaveLength(2);
    expect(pageTwo.body.users[0]).toMatchObject({ firstName: 'Paolo', lastName: 'Reyes' });
    expect(pageTwo.body.users[1]).toMatchObject({ firstName: 'Mara', lastName: 'Santos' });

    // pages don't overlap or skip rows
    const idsPageOne = pageOne.body.users.map((user: { id: string }) => user.id);
    const idsPageTwo = pageTwo.body.users.map((user: { id: string }) => user.id);
    expect(new Set([...idsPageOne, ...idsPageTwo]).size).toBe(4);
  });

  it('clamps pageSize to the server-enforced maximum', async () => {
    const app = createApp(createRepositories(dataLayer));
    const cookie = await loginAsStMarysAdmin(app);

    const response = await request(app)
      .get('/api/admin/schools/school-st-marys/users?page=1&pageSize=1000')
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.pageSize).toBe(100);
    expect(response.body.users.length).toBeLessThanOrEqual(100);
  });

  it('filters users by search, role, and status', async () => {
    const app = createApp(createRepositories(dataLayer));
    const cookie = await loginAsStMarysAdmin(app);

    const searchResponse = await request(app)
      .get('/api/admin/schools/school-st-marys/users?search=garcia')
      .set('Cookie', cookie);
    expect(searchResponse.body.total).toBe(2);
    expect(searchResponse.body.users.every((user: { lastName: string }) => user.lastName === 'Garcia')).toBe(
      true
    );

    const roleResponse = await request(app)
      .get('/api/admin/schools/school-st-marys/users?role=STUDENT')
      .set('Cookie', cookie);
    expect(roleResponse.body.total).toBe(1);
    expect(roleResponse.body.users[0]).toMatchObject({ role: 'STUDENT', firstName: 'Lia' });

    await request(app)
      .post('/api/admin/schools/school-st-marys/users/user-stmarys-guardian/deactivate')
      .set('Cookie', cookie);

    const inactiveResponse = await request(app)
      .get('/api/admin/schools/school-st-marys/users?status=inactive')
      .set('Cookie', cookie);
    expect(inactiveResponse.body.total).toBe(1);
    expect(inactiveResponse.body.users[0].id).toBe('user-stmarys-guardian');

    const activeResponse = await request(app)
      .get('/api/admin/schools/school-st-marys/users?status=active')
      .set('Cookie', cookie);
    expect(activeResponse.body.total).toBe(3);
  });

  it('sorts users by email descending with a deterministic tiebreaker', async () => {
    const app = createApp(createRepositories(dataLayer));
    const cookie = await loginAsStMarysAdmin(app);

    const response = await request(app)
      .get('/api/admin/schools/school-st-marys/users?sort=email&dir=desc&pageSize=100')
      .set('Cookie', cookie);

    const emails = response.body.users.map((user: { email: string }) => user.email);
    const sorted = [...emails].sort().reverse();
    expect(emails).toEqual(sorted);
  });

  it('falls back to the default sort when given an unknown sort field', async () => {
    const app = createApp(createRepositories(dataLayer));
    const cookie = await loginAsStMarysAdmin(app);

    const response = await request(app)
      .get('/api/admin/schools/school-st-marys/users?sort=not-a-real-field&pageSize=100')
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.users[0]).toMatchObject({ firstName: 'Ana', lastName: 'Garcia' });
  });

  it('never leaks another school row into a paginated user list', async () => {
    const app = createApp(createRepositories(dataLayer));
    const cookie = await loginAsStMarysAdmin(app);

    const response = await request(app)
      .get('/api/admin/schools/school-st-marys/users?pageSize=100')
      .set('Cookie', cookie);

    expect(
      response.body.users.every((user: { schoolId: string }) => user.schoolId === 'school-st-marys')
    ).toBe(true);
  });

  it('paginates and filters the device list', async () => {
    const app = createApp(createRepositories(dataLayer));
    const cookie = await loginAsStMarysAdmin(app);

    await request(app)
      .post('/api/admin/schools/school-st-marys/devices')
      .set('Cookie', cookie)
      .send({ name: 'Library Scanner', location: 'Library entrance' });

    const listResponse = await request(app)
      .get('/api/admin/schools/school-st-marys/devices?page=1&pageSize=1&sort=name&dir=asc')
      .set('Cookie', cookie);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.total).toBe(2);
    expect(listResponse.body.devices).toHaveLength(1);
    expect(listResponse.body.devices[0].name).toBe('Library Scanner');

    const searchResponse = await request(app)
      .get('/api/admin/schools/school-st-marys/devices?search=gate')
      .set('Cookie', cookie);
    expect(searchResponse.body.total).toBe(1);
    expect(searchResponse.body.devices[0].location).toBe('Main gate');

    expect(
      listResponse.body.devices.every(
        (device: { schoolId: string }) => device.schoolId === 'school-st-marys'
      )
    ).toBe(true);
  });
});
