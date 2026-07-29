import request from 'supertest';
import { createApp } from '../src/app.js';
import { createRepositories, describeForDataLayers } from './helpers/dataLayer.js';

describeForDataLayers('Phase 3 attendance routes', (dataLayer) => {
  it('rejects unauthenticated access to attendance logs', async () => {
    const app = createApp(createRepositories(dataLayer));

    const response = await request(app).get('/api/attendance/logs?school=st-marys');

    expect(response.status).toBe(401);
  });

  it('ignores a forged school query and returns only the JWT school attendance log', async () => {
    const app = createApp(createRepositories(dataLayer));
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'admin@stmarys.edu',
      password: 'Password123!',
      schoolSlug: 'st-marys'
    });
    const cookie = loginResponse.headers['set-cookie'][0];
    await request(app)
      .post('/api/device/scan')
      .set('X-Device-Key', 'seeded-device-key-stmarys')
      .send({ cardUid: 'RFID-STMARYS-001' });

    const response = await request(app)
      .get('/api/attendance/logs?school=riverside-tech')
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.records).toHaveLength(1);
    expect(response.body.records[0].log.schoolId).toBe('school-st-marys');
  });

  it('forbids a non-staff account from opening an attendance stream', async () => {
    const app = createApp(createRepositories(dataLayer));
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'student@stmarys.edu',
      password: 'Password123!',
      schoolSlug: 'st-marys'
    });
    const cookie = loginResponse.headers['set-cookie'][0];

    const response = await request(app)
      .get('/api/attendance/stream?school=st-marys')
      .set('Cookie', cookie);

    expect(response.status).toBe(403);
  });

  it('returns the signed-in school attendance log after a scan is recorded', async () => {
    const app = createApp(createRepositories(dataLayer));
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'admin@stmarys.edu',
      password: 'Password123!',
      schoolSlug: 'st-marys'
    });
    const cookie = loginResponse.headers['set-cookie'][0];

    const scanResponse = await request(app)
      .post('/api/device/scan')
      .set('X-Device-Key', 'seeded-device-key-stmarys')
      .send({ cardUid: 'RFID-STMARYS-001' });

    expect(scanResponse.status).toBe(200);

    const logResponse = await request(app)
      .get('/api/attendance/logs?school=st-marys&page=1&pageSize=10')
      .set('Cookie', cookie);

    expect(logResponse.status).toBe(200);
    expect(logResponse.body.records[0]).toMatchObject({
      student: {
        firstName: 'Lia',
        lastName: 'Garcia'
      },
      device: {
        name: "St. Mary's Front Gate"
      },
      log: {
        verdict: 'ADMITTED'
      }
    });
  });

  it('filters attendance records and exports every matching row as CSV', async () => {
    const app = createApp(createRepositories(dataLayer));
    await request(app)
      .post('/api/device/scan')
      .set('X-Device-Key', 'seeded-device-key-stmarys')
      .send({ cardUid: 'RFID-STMARYS-001' });
    await request(app)
      .post('/api/device/scan')
      .set('X-Device-Key', 'seeded-device-key-stmarys')
      .send({ cardUid: 'UNKNOWN-CARD' });

    const login = await request(app).post('/api/auth/login').send({
      email: 'admin@stmarys.edu',
      password: 'Password123!'
    });
    const cookie = login.headers['set-cookie'][0];
    const filtered = await request(app)
      .get('/api/attendance/logs?verdict=DENIED&search=recognized')
      .set('Cookie', cookie);
    expect(filtered.status).toBe(200);
    expect(filtered.body.total).toBe(1);
    expect(filtered.body.records[0].log).toMatchObject({
      verdict: 'DENIED',
      message: 'Card not recognized.'
    });

    const exported = await request(app)
      .get('/api/attendance/export?verdict=ADMITTED')
      .set('Cookie', cookie);
    expect(exported.status).toBe(200);
    expect(exported.headers['content-type']).toContain('text/csv');
    expect(exported.text).toContain('Lia Garcia');
    expect(exported.text).not.toContain('Unknown card');

    const selectedColumnExport = await request(app)
      .get('/api/attendance/export?verdict=ADMITTED&columns=student,verdict')
      .set('Cookie', cookie);
    expect(selectedColumnExport.status).toBe(200);
    expect(selectedColumnExport.text).toContain('"Person","Verdict"');
    expect(selectedColumnExport.text).not.toContain('"Message"');

    const invalidColumnExport = await request(app)
      .get('/api/attendance/export?columns=student,passwordHash')
      .set('Cookie', cookie);
    expect(invalidColumnExport.status).toBe(400);
    expect(invalidColumnExport.body.message).toBe('Invalid export column selection.');

    const audit = await request(app)
      .get('/api/admin/schools/school-st-marys/audit-logs?action=ATTENDANCE_EXPORTED')
      .set('Cookie', cookie);
    expect(audit.body.records).toHaveLength(2);
    expect(audit.body.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'ATTENDANCE_EXPORTED',
          actorUserId: 'user-stmarys-admin'
        })
      ])
    );
  });

  it('limits student and guardian attendance logs to their own authorized records', async () => {
    const app = createApp(createRepositories(dataLayer));
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@stmarys.edu',
      password: 'Password123!',
      schoolSlug: 'st-marys'
    });
    const adminCookie = adminLogin.headers['set-cookie'][0];

    const secondStudent = await request(app)
      .post('/api/admin/schools/school-st-marys/users')
      .set('Cookie', adminCookie)
      .send({
        email: 'second.student@stmarys.edu',
        password: 'Password123!',
        firstName: 'Mina',
        lastName: 'Lopez',
        role: 'STUDENT',
        cardUid: 'RFID-STMARYS-002',
        gradeLevel: 'Grade 10',
        section: 'Emerald'
      });
    expect(secondStudent.status).toBe(201);

    for (const cardUid of ['RFID-STMARYS-001', 'RFID-STMARYS-002']) {
      const scan = await request(app)
        .post('/api/device/scan')
        .set('X-Device-Key', 'seeded-device-key-stmarys')
        .send({ cardUid });
      expect(scan.status).toBe(200);
    }

    const studentLogin = await request(app).post('/api/auth/login').send({
      email: 'student@stmarys.edu',
      password: 'Password123!',
      schoolSlug: 'st-marys'
    });
    const studentLogs = await request(app)
      .get('/api/attendance/logs?school=st-marys')
      .set('Cookie', studentLogin.headers['set-cookie'][0]);

    expect(studentLogs.status).toBe(200);
    expect(studentLogs.body.records).toHaveLength(1);
    expect(studentLogs.body.records[0].student.id).toBe('user-stmarys-student');

    const guardianLogin = await request(app).post('/api/auth/login').send({
      email: 'guardian@stmarys.edu',
      password: 'Password123!',
      schoolSlug: 'st-marys'
    });
    const guardianLogs = await request(app)
      .get('/api/attendance/logs?school=st-marys')
      .set('Cookie', guardianLogin.headers['set-cookie'][0]);

    expect(guardianLogs.status).toBe(200);
    expect(guardianLogs.body.records).toHaveLength(1);
    expect(guardianLogs.body.records[0].student.id).toBe('user-stmarys-student');

    const guardianStream = await request(app)
      .get('/api/attendance/stream?school=st-marys')
      .set('Cookie', guardianLogin.headers['set-cookie'][0]);
    expect(guardianStream.status).toBe(403);
  });

  it('accepts keyed scans for a registered device without a school session', async () => {
    const app = createApp(createRepositories(dataLayer));
    const adminLoginResponse = await request(app).post('/api/auth/login').send({
      email: 'admin@stmarys.edu',
      password: 'Password123!',
      schoolSlug: 'st-marys'
    });
    const adminCookie = adminLoginResponse.headers['set-cookie'][0];

    const deviceCreateResponse = await request(app)
      .post('/api/admin/schools/school-st-marys/devices')
      .set('Cookie', adminCookie)
      .send({
        name: 'Gym Gate Scanner',
        location: 'Gym lobby'
      });

    expect(deviceCreateResponse.status).toBe(201);

    const scanResponse = await request(app)
      .post('/api/device/scan')
      .set('X-Device-Key', deviceCreateResponse.body.deviceKey)
      .send({
        cardUid: 'RFID-STMARYS-001'
      });

    expect(scanResponse.status).toBe(200);
    expect(scanResponse.body).toMatchObject({
      schoolId: 'school-st-marys',
      deviceName: 'Gym Gate Scanner',
      deviceLocation: 'Gym lobby',
      verdict: 'ADMITTED'
    });
  });

  it('rejects keyed scans when the device key and requested school do not match', async () => {
    const app = createApp(createRepositories(dataLayer));
    const adminLoginResponse = await request(app).post('/api/auth/login').send({
      email: 'admin@stmarys.edu',
      password: 'Password123!',
      schoolSlug: 'st-marys'
    });
    const adminCookie = adminLoginResponse.headers['set-cookie'][0];

    const deviceCreateResponse = await request(app)
      .post('/api/admin/schools/school-st-marys/devices')
      .set('Cookie', adminCookie)
      .send({
        name: 'Annex Scanner',
        location: 'Annex gate'
      });

    const scanResponse = await request(app)
      .post('/api/device/scan')
      .set('X-Device-Key', deviceCreateResponse.body.deviceKey)
      .send({
        schoolSlug: 'riverside-tech',
        cardUid: 'RFID-STMARYS-001'
      });

    expect(scanResponse.status).toBe(403);
    expect(scanResponse.body.message).toBe('Device key does not match the requested school.');
  });

  it('restricts browser scan simulation to system support', async () => {
    const app = createApp(createRepositories(dataLayer));
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@stmarys.edu',
      password: 'Password123!'
    });
    const adminResponse = await request(app)
      .post('/api/device/scan')
      .set('Cookie', adminLogin.headers['set-cookie'][0])
      .send({
        schoolSlug: 'st-marys',
        cardUid: 'RFID-STMARYS-001'
      });
    expect(adminResponse.status).toBe(403);
    expect(adminResponse.body.message).toBe(
      'Browser scan simulation is restricted to system support.'
    );

    const supportLogin = await request(app).post('/api/auth/login').send({
      email: 'support@perl.system',
      password: 'Support123!'
    });
    const supportResponse = await request(app)
      .post('/api/device/scan')
      .set('Cookie', supportLogin.headers['set-cookie'][0])
      .send({
        schoolSlug: 'st-marys',
        cardUid: 'RFID-STMARYS-001'
      });
    expect(supportResponse.status).toBe(200);
    expect(supportResponse.body.schoolId).toBe('school-st-marys');
  });

  it('rate limits repeated device scan attempts from the same source', async () => {
    const app = createApp(createRepositories(dataLayer));

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await request(app)
        .post('/api/device/scan')
        .set('X-Device-Key', 'seeded-device-key-stmarys')
        .set('X-Forwarded-For', `203.0.113.${attempt + 1}`)
        .send({
          schoolSlug: 'st-marys',
          cardUid: 'RFID-STMARYS-001'
        });

      expect([200, 400]).toContain(response.status);
    }

    const throttledResponse = await request(app)
      .post('/api/device/scan')
      .set('X-Device-Key', 'seeded-device-key-stmarys')
      .set('X-Forwarded-For', '203.0.113.250')
      .send({
        schoolSlug: 'st-marys',
        cardUid: 'RFID-STMARYS-001'
      });

    expect(throttledResponse.status).toBe(429);
    expect(throttledResponse.body.message).toBe('Too many scan attempts. Please try again later.');
    expect(throttledResponse.headers['retry-after']).toEqual(expect.any(String));
  });
});
