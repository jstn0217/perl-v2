import request from 'supertest';
import { createApp } from '../src/app.js';
import { createRepositories, describeForDataLayers } from './helpers/dataLayer.js';

const pngImage = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  Buffer.from('test-image')
]);

describeForDataLayers('Phase 4 admin routes', (dataLayer) => {
  it('lets the seeded system admin create a school and audits the provisioning action', async () => {
    const app = createApp(createRepositories(dataLayer));
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'system@perl.system',
      password: 'SystemAdmin123!'
    });
    const cookie = loginResponse.headers['set-cookie'][0];

    const createResponse = await request(app)
      .post('/api/support/schools')
      .set('Cookie', cookie)
      .send({
        name: 'Northview Academy',
        slug: 'northview-academy',
        contactEmail: 'admin@northview.edu',
        theme: {
          primaryColor: '#123456',
          secondaryColor: '#F2F6FA',
          accentColor: '#FFAA00'
        }
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.school).toMatchObject({
      id: expect.stringMatching(/^school-/),
      slug: 'northview-academy',
      name: 'Northview Academy'
    });

    const schoolsResponse = await request(app)
      .get('/api/support/schools')
      .set('Cookie', cookie);
    expect(schoolsResponse.body.schools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: 'northview-academy' })
      ])
    );

    const auditResponse = await request(app)
      .get(`/api/support/audit-logs?schoolId=${createResponse.body.school.id}`)
      .set('Cookie', cookie);
    expect(auditResponse.body.records).toEqual([
      expect.objectContaining({
        action: 'SCHOOL_CREATED',
        actorUserId: 'platform-user-system-admin',
        supportInitiated: true,
        targetId: createResponse.body.school.id
      })
    ]);
  });

  it('forbids school admins from provisioning new schools', async () => {
    const app = createApp(createRepositories(dataLayer));
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'admin@stmarys.edu',
      password: 'Password123!'
    });
    const cookie = loginResponse.headers['set-cookie'][0];

    const response = await request(app)
      .post('/api/support/schools')
      .set('Cookie', cookie)
      .send({
        name: 'Forbidden Academy',
        slug: 'forbidden-academy',
        contactEmail: 'admin@forbidden.edu'
      });

    expect(response.status).toBe(403);
  });

  it('keeps support read-only while allowing cross-school inspection and diagnostics', async () => {
    const app = createApp(createRepositories(dataLayer));
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'support@perl.system',
      password: 'Support123!'
    });
    const cookie = loginResponse.headers['set-cookie'][0];

    const schoolList = await request(app).get('/api/support/schools').set('Cookie', cookie);
    const people = await request(app)
      .get('/api/admin/schools/school-riverside/users')
      .set('Cookie', cookie);
    const createSchool = await request(app)
      .post('/api/support/schools')
      .set('Cookie', cookie)
      .send({
        name: 'Support Cannot Create',
        slug: 'support-cannot-create',
        contactEmail: 'support@example.edu'
      });
    const updateProfile = await request(app)
      .patch('/api/admin/schools/school-riverside/profile')
      .set('Cookie', cookie)
      .send({ contactEmail: 'forbidden-update@example.edu' });

    expect(schoolList.status).toBe(200);
    expect(people.status).toBe(200);
    expect(createSchool.status).toBe(403);
    expect(updateProfile.status).toBe(403);
  });

  it('lets only system admins manage school SMS subscriptions', async () => {
    const app = createApp(createRepositories(dataLayer));
    const systemLogin = await request(app).post('/api/auth/login').send({
      email: 'system@perl.system',
      password: 'SystemAdmin123!'
    });
    const supportLogin = await request(app).post('/api/auth/login').send({
      email: 'support@perl.system',
      password: 'Support123!'
    });

    const update = await request(app)
      .patch('/api/support/schools/school-golden/sms-settings')
      .set('Cookie', systemLogin.headers['set-cookie'][0])
      .send({ smsEnabled: true, smsSenderName: 'GOLDEN' });
    const forbidden = await request(app)
      .patch('/api/support/schools/school-golden/sms-settings')
      .set('Cookie', supportLogin.headers['set-cookie'][0])
      .send({ smsEnabled: false });

    expect(update.status).toBe(200);
    expect(update.body.school).toMatchObject({
      smsEnabled: true,
      smsSenderName: 'GOLDEN'
    });
    expect(forbidden.status).toBe(403);
  });

  it('marks every system-admin mutation as support initiated in the global action log', async () => {
    const app = createApp(createRepositories(dataLayer));
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'system@perl.system',
      password: 'SystemAdmin123!'
    });
    const cookie = loginResponse.headers['set-cookie'][0];

    const accessResponse = await request(app)
      .post('/api/support/schools/school-riverside/access')
      .set('Cookie', cookie);
    expect(accessResponse.status).toBe(200);

    const updateResponse = await request(app)
      .patch('/api/admin/schools/school-riverside/profile')
      .set('Cookie', cookie)
      .send({ contactEmail: 'support-updated@riversidetech.edu' });

    expect(updateResponse.status).toBe(200);

    const auditResponse = await request(app)
      .get('/api/support/audit-logs?schoolId=school-riverside')
      .set('Cookie', cookie);

    expect(auditResponse.status).toBe(200);
    expect(auditResponse.body.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          schoolId: 'school-riverside',
          actorUserId: 'platform-user-system-admin',
          actorRole: 'SYSTEM_ADMIN',
          supportInitiated: true,
          action: 'SCHOOL_PROFILE_UPDATED',
          targetId: 'school-riverside',
          changeSummary: expect.stringContaining('contactEmail')
        }),
        expect.objectContaining({
          action: 'SUPPORT_CONTEXT_ACCESSED',
          targetId: 'school-riverside',
          supportInitiated: true
        })
      ])
    );
  });

  it('persists guardian-to-student links and rejects cross-school links', async () => {
    const app = createApp(createRepositories(dataLayer));
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'admin@stmarys.edu',
      password: 'Password123!',
      schoolSlug: 'st-marys'
    });
    const cookie = loginResponse.headers['set-cookie'][0];

    const updateResponse = await request(app)
      .patch('/api/admin/schools/school-st-marys/users/user-stmarys-guardian')
      .set('Cookie', cookie)
      .send({ linkedStudentIds: ['user-stmarys-student'] });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.user.linkedStudentIds).toEqual(['user-stmarys-student']);

    const crossSchoolResponse = await request(app)
      .patch('/api/admin/schools/school-st-marys/users/user-stmarys-guardian')
      .set('Cookie', cookie)
      .send({ linkedStudentIds: ['user-riverside-student'] });

    expect(crossSchoolResponse.status).toBe(400);
    expect(crossSchoolResponse.body.message).toBe(
      'Guardian links must reference students from the same school.'
    );
  });

  it('imports school people with row errors, guardian links, audit filtering, and CSV export', async () => {
    const app = createApp(createRepositories(dataLayer));
    const login = await request(app).post('/api/auth/login').send({
      email: 'admin@stmarys.edu',
      password: 'Password123!'
    });
    const cookie = login.headers['set-cookie'][0];

    const imported = await request(app)
      .post('/api/admin/schools/school-st-marys/users/import')
      .set('Cookie', cookie)
      .send({
        rows: [
          {
            email: 'imported.student@stmarys.edu',
            password: 'Password123!',
            firstName: 'Nina',
            lastName: 'Cruz',
            role: 'STUDENT',
            cardUid: 'RFID-IMPORTED-001',
            gradeLevel: 'Grade 8',
            section: 'Pearl'
          },
          {
            email: 'imported.guardian@stmarys.edu',
            password: 'Password123!',
            firstName: 'Rosa',
            lastName: 'Cruz',
            role: 'GUARDIAN',
            linkedStudentEmails: ['imported.student@stmarys.edu']
          },
          {
            email: 'admin@stmarys.edu',
            password: 'Password123!',
            firstName: 'Duplicate',
            lastName: 'Admin',
            role: 'ADMIN'
          }
        ]
      });

    expect(imported.status).toBe(207);
    expect(imported.body.created).toHaveLength(2);
    expect(imported.body.errors).toEqual([
      expect.objectContaining({ row: 4, message: 'A user with that email already exists.' })
    ]);
    const guardian = imported.body.created.find(
      (user: { role: string }) => user.role === 'GUARDIAN'
    );
    const student = imported.body.created.find(
      (user: { role: string }) => user.role === 'STUDENT'
    );
    expect(guardian.linkedStudentIds).toEqual([student.id]);

    const filteredAudit = await request(app)
      .get('/api/admin/schools/school-st-marys/audit-logs?action=USERS_IMPORTED')
      .set('Cookie', cookie);
    expect(filteredAudit.status).toBe(200);
    expect(filteredAudit.body.total).toBe(1);
    expect(filteredAudit.body.records[0].changeSummary).toContain('Imported 2 school users');

    const exportedAudit = await request(app)
      .get(
        '/api/admin/schools/school-st-marys/audit-logs/export?action=USERS_IMPORTED&columns=occurredAt,action,changeSummary'
      )
      .set('Cookie', cookie);
    expect(exportedAudit.status).toBe(200);
    expect(exportedAudit.headers['content-type']).toContain('text/csv');
    expect(exportedAudit.text).toContain('"Occurred at","Action","Change summary"');
    expect(exportedAudit.text).toContain('USERS_IMPORTED');
    expect(exportedAudit.text).not.toContain('"Actor user ID"');
  });

  it('forbids cross-school access across all admin route families', async () => {
    const app = createApp(createRepositories(dataLayer));
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'admin@stmarys.edu',
      password: 'Password123!',
      schoolSlug: 'st-marys'
    });
    const cookie = loginResponse.headers['set-cookie'][0];

    const schoolBUserId = 'user-riverside-student';
    const requests = [
      () => request(app).get('/api/admin/schools/school-riverside/summary').set('Cookie', cookie),
      () => request(app).get('/api/admin/schools/school-riverside/profile').set('Cookie', cookie),
      () =>
        request(app)
          .patch('/api/admin/schools/school-riverside/profile')
          .set('Cookie', cookie)
          .send({ name: 'Blocked rename' }),
      () => request(app).get('/api/admin/schools/school-riverside/users').set('Cookie', cookie),
      () =>
        request(app)
          .post('/api/admin/schools/school-riverside/users')
          .set('Cookie', cookie)
          .send({
            email: 'intruder@riversidetech.edu',
            password: 'Password123!',
            firstName: 'Intruder',
            lastName: 'User',
            role: 'STUDENT'
          }),
      () =>
        request(app)
          .post('/api/admin/schools/school-riverside/users/import')
          .set('Cookie', cookie)
          .send({ rows: [] }),
      () =>
        request(app)
          .patch(`/api/admin/schools/school-riverside/users/${schoolBUserId}`)
          .set('Cookie', cookie)
          .send({ section: 'Blocked' }),
      () =>
        request(app)
          .post('/api/admin/schools/school-riverside/logo')
          .set('Cookie', cookie)
          .attach('image', pngImage, { filename: 'logo.png', contentType: 'image/png' }),
      () =>
        request(app)
          .post(`/api/admin/schools/school-riverside/users/${schoolBUserId}/image`)
          .set('Cookie', cookie)
          .attach('image', pngImage, { filename: 'user.png', contentType: 'image/png' }),
      () =>
        request(app)
          .post(`/api/admin/schools/school-riverside/users/${schoolBUserId}/deactivate`)
          .set('Cookie', cookie),
      () => request(app).get('/api/admin/schools/school-riverside/devices').set('Cookie', cookie),
      () =>
        request(app)
          .post('/api/admin/schools/school-riverside/devices')
          .set('Cookie', cookie)
          .send({ name: 'Blocked scanner', location: 'Blocked gate' }),
      () =>
        request(app)
          .post('/api/admin/schools/school-riverside/devices/device-riverside-lobby/rotate-key')
          .set('Cookie', cookie),
      () =>
        request(app)
          .post('/api/admin/schools/school-riverside/devices/device-riverside-lobby/deactivate')
          .set('Cookie', cookie),
      () => request(app).get('/api/admin/schools/school-riverside/audit-logs').set('Cookie', cookie),
      () => request(app).get('/api/admin/schools/school-riverside/export').set('Cookie', cookie),
      () => request(app).get('/api/admin/schools/school-riverside/backup').set('Cookie', cookie),
      () =>
        request(app)
          .get(`/api/admin/schools/school-riverside/users/${schoolBUserId}/export`)
          .set('Cookie', cookie),
      () =>
        request(app)
          .delete(`/api/admin/schools/school-riverside/users/${schoolBUserId}/data`)
          .set('Cookie', cookie)
          .send({ confirmEmail: 'student@riversidetech.edu' }),
      () =>
        request(app)
          .delete('/api/admin/schools/school-riverside/data')
          .set('Cookie', cookie)
          .send({ confirmSlug: 'riverside-tech' }),
      () =>
        request(app)
          .post('/api/admin/schools/school-riverside/restore')
          .set('Cookie', cookie)
          .send({})
    ];

    for (const send of requests) {
      const response = await send();

      expect(response.status).toBe(403);
    }
  });

  it('updates the school profile for the authenticated admin school', async () => {
    const app = createApp(createRepositories(dataLayer));
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'admin@stmarys.edu',
      password: 'Password123!',
      schoolSlug: 'st-marys'
    });
    const cookie = loginResponse.headers['set-cookie'][0];

    const updateResponse = await request(app)
      .patch('/api/admin/schools/school-st-marys/profile')
      .set('Cookie', cookie)
      .send({
        name: "St. Mary's Academy North",
        contactEmail: 'north-campus@stmarys.edu',
        theme: {
          primaryColor: '#123456',
          secondaryColor: '#EAF2FF',
          accentColor: '#FFAA11'
        }
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.school).toMatchObject({
      id: 'school-st-marys',
      name: "St. Mary's Academy North",
      contactEmail: 'north-campus@stmarys.edu',
      theme: {
        primaryColor: '#123456',
        secondaryColor: '#EAF2FF',
        accentColor: '#FFAA11'
      }
    });

    const schoolContextResponse = await request(app)
      .get('/api/school/current')
      .set('Cookie', cookie);

    expect(schoolContextResponse.status).toBe(200);
    expect(schoolContextResponse.body.school).toMatchObject({
      name: "St. Mary's Academy North",
      contactEmail: 'north-campus@stmarys.edu'
    });
  });

  it('uploads and persists school and user images through the image storage port', async () => {
    const app = createApp(createRepositories(dataLayer));
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'admin@stmarys.edu',
      password: 'Password123!',
      schoolSlug: 'st-marys'
    });
    const cookie = loginResponse.headers['set-cookie'][0];

    const logoResponse = await request(app)
      .post('/api/admin/schools/school-st-marys/logo')
      .set('Cookie', cookie)
      .attach('image', pngImage, { filename: 'logo.png', contentType: 'image/png' });
    expect(logoResponse.status).toBe(200);
    expect(logoResponse.body.school.logoUrl).toMatch(/^data:image\/png;base64,/);

    const userResponse = await request(app)
      .post('/api/admin/schools/school-st-marys/users/user-stmarys-student/image')
      .set('Cookie', cookie)
      .attach('image', pngImage, { filename: 'student.png', contentType: 'image/png' });
    expect(userResponse.status).toBe(200);
    expect(userResponse.body.user.imageUrl).toMatch(/^data:image\/png;base64,/);
    expect(userResponse.body.user.passwordHash).toBeUndefined();

    const auditResponse = await request(app)
      .get('/api/admin/schools/school-st-marys/audit-logs')
      .set('Cookie', cookie);
    expect(auditResponse.body.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'SCHOOL_LOGO_UPDATED', targetId: 'school-st-marys' }),
        expect.objectContaining({ action: 'USER_IMAGE_UPDATED', targetId: 'user-stmarys-student' })
      ])
    );
  });

  it('rejects a file whose content does not match an allowed image type', async () => {
    const app = createApp(createRepositories(dataLayer));
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'admin@stmarys.edu',
      password: 'Password123!',
      schoolSlug: 'st-marys'
    });
    const cookie = loginResponse.headers['set-cookie'][0];

    const response = await request(app)
      .post('/api/admin/schools/school-st-marys/logo')
      .set('Cookie', cookie)
      .attach('image', Buffer.from('not-an-image'), { filename: 'fake.png', contentType: 'image/png' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Uploaded file is not a valid JPEG, PNG, or WebP image.');
  });

  it('creates, updates, and deactivates a school-scoped user', async () => {
    const app = createApp(createRepositories(dataLayer));
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'admin@stmarys.edu',
      password: 'Password123!',
      schoolSlug: 'st-marys'
    });
    const cookie = loginResponse.headers['set-cookie'][0];

    const createResponse = await request(app)
      .post('/api/admin/schools/school-st-marys/users')
      .set('Cookie', cookie)
      .send({
        email: 'new.student@stmarys.edu',
        password: 'Password123!',
        firstName: 'Mina',
        lastName: 'Lopez',
        role: 'STUDENT',
        cardUid: 'RFID-STMARYS-099',
        gradeLevel: 'Grade 8',
        section: 'Sapphire'
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.user).toMatchObject({
      schoolId: 'school-st-marys',
      email: 'new.student@stmarys.edu',
      firstName: 'Mina',
      lastName: 'Lopez',
      role: 'STUDENT',
      cardUid: 'RFID-STMARYS-099',
      isActive: true
    });

    const createdUserId = createResponse.body.user.id as string;

    const updateResponse = await request(app)
      .patch(`/api/admin/schools/school-st-marys/users/${createdUserId}`)
      .set('Cookie', cookie)
      .send({
        section: 'Ruby',
        gradeLevel: 'Grade 9'
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.user).toMatchObject({
      id: createdUserId,
      gradeLevel: 'Grade 9',
      section: 'Ruby'
    });

    const deactivateResponse = await request(app)
      .post(`/api/admin/schools/school-st-marys/users/${createdUserId}/deactivate`)
      .set('Cookie', cookie);

    expect(deactivateResponse.status).toBe(200);
    expect(deactivateResponse.body.user).toMatchObject({
      id: createdUserId,
      isActive: false
    });

    const reloginResponse = await request(app).post('/api/auth/login').send({
      email: 'new.student@stmarys.edu',
      password: 'Password123!',
      schoolSlug: 'st-marys'
    });

    expect(reloginResponse.status).toBe(401);

    const auditResponse = await request(app)
      .get('/api/admin/schools/school-st-marys/audit-logs')
      .set('Cookie', cookie);
    expect(auditResponse.body.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'USER_CREATED', targetId: createdUserId }),
        expect.objectContaining({ action: 'USER_UPDATED', targetId: createdUserId }),
        expect.objectContaining({ action: 'USER_DEACTIVATED', targetId: createdUserId })
      ])
    );

    const portableExport = await request(app)
      .get('/api/admin/schools/school-st-marys/export')
      .set('Cookie', cookie);
    expect(portableExport.body.auditRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'USER_CREATED', targetId: createdUserId }),
        expect.objectContaining({ action: 'USER_UPDATED', targetId: createdUserId }),
        expect.objectContaining({ action: 'USER_DEACTIVATED', targetId: createdUserId })
      ])
    );
  });

  it('rejects duplicate or cross-school card UID assignments', async () => {
    const app = createApp(createRepositories(dataLayer));
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'admin@stmarys.edu',
      password: 'Password123!',
      schoolSlug: 'st-marys'
    });
    const cookie = loginResponse.headers['set-cookie'][0];

    const sameSchoolResponse = await request(app)
      .post('/api/admin/schools/school-st-marys/users')
      .set('Cookie', cookie)
      .send({
        email: 'dup.student@stmarys.edu',
        password: 'Password123!',
        firstName: 'Lina',
        lastName: 'Cruz',
        role: 'STUDENT',
        cardUid: 'RFID-STMARYS-001'
      });

    expect(sameSchoolResponse.status).toBe(400);
    expect(sameSchoolResponse.body.message).toBe('A user with that card UID already exists for this school.');

    const crossSchoolResponse = await request(app)
      .post('/api/admin/schools/school-st-marys/users')
      .set('Cookie', cookie)
      .send({
        email: 'cross.student@stmarys.edu',
        password: 'Password123!',
        firstName: 'Nika',
        lastName: 'Uy',
        role: 'STUDENT',
        cardUid: 'RFID-RIVERSIDE-001'
      });

    expect(crossSchoolResponse.status).toBe(400);
    expect(crossSchoolResponse.body.message).toBe('Card UID values must remain unique across schools.');
  });

  it('registers and lists school-scoped devices while returning the raw device key only on creation', async () => {
    const app = createApp(createRepositories(dataLayer));
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'admin@stmarys.edu',
      password: 'Password123!',
      schoolSlug: 'st-marys'
    });
    const cookie = loginResponse.headers['set-cookie'][0];

    const createResponse = await request(app)
      .post('/api/admin/schools/school-st-marys/devices')
      .set('Cookie', cookie)
      .send({
        name: 'Library Scanner',
        location: 'Library entrance'
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toMatchObject({
      device: {
        schoolId: 'school-st-marys',
        name: 'Library Scanner',
        location: 'Library entrance',
        isActive: true
      }
    });
    expect(createResponse.body.deviceKey).toEqual(expect.any(String));
    expect(createResponse.body.deviceKey).toHaveLength(48);

    const listResponse = await request(app)
      .get('/api/admin/schools/school-st-marys/devices')
      .set('Cookie', cookie);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.devices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          schoolId: 'school-st-marys',
          name: 'Library Scanner',
          location: 'Library entrance',
          keyLastFour: createResponse.body.deviceKey.slice(-4)
        })
      ])
    );
    expect(JSON.stringify(listResponse.body.devices)).not.toContain(createResponse.body.deviceKey);

    const originalKey = createResponse.body.deviceKey as string;
    const deviceId = createResponse.body.device.id as string;
    const rotateResponse = await request(app)
      .post(`/api/admin/schools/school-st-marys/devices/${deviceId}/rotate-key`)
      .set('Cookie', cookie);
    expect(rotateResponse.status).toBe(200);
    expect(rotateResponse.body.deviceKey).toHaveLength(48);
    expect(rotateResponse.body.deviceKey).not.toBe(originalKey);

    const oldKeyScan = await request(app)
      .post('/api/device/scan')
      .set('X-Device-Key', originalKey)
      .send({ cardUid: 'RFID-STMARYS-001' });
    expect(oldKeyScan.status).toBe(401);

    const newKey = rotateResponse.body.deviceKey as string;
    const newKeyScan = await request(app)
      .post('/api/device/scan')
      .set('X-Device-Key', newKey)
      .send({ cardUid: 'RFID-STMARYS-001' });
    expect(newKeyScan.status).toBe(200);

    const deactivateResponse = await request(app)
      .post(`/api/admin/schools/school-st-marys/devices/${deviceId}/deactivate`)
      .set('Cookie', cookie);
    expect(deactivateResponse.status).toBe(200);
    expect(deactivateResponse.body.device.isActive).toBe(false);

    const revokedKeyScan = await request(app)
      .post('/api/device/scan')
      .set('X-Device-Key', newKey)
      .send({ cardUid: 'RFID-STMARYS-001' });
    expect(revokedKeyScan.status).toBe(401);

    const auditResponse = await request(app)
      .get('/api/admin/schools/school-st-marys/audit-logs?page=1&pageSize=10')
      .set('Cookie', cookie);
    expect(auditResponse.status).toBe(200);
    expect(auditResponse.body.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'DEVICE_REGISTERED', targetId: deviceId }),
        expect.objectContaining({ action: 'DEVICE_KEY_ROTATED', targetId: deviceId }),
        expect.objectContaining({ action: 'DEVICE_DEACTIVATED', targetId: deviceId })
      ])
    );
    expect(JSON.stringify(auditResponse.body)).not.toContain(originalKey);
    expect(JSON.stringify(auditResponse.body)).not.toContain(newKey);
  });

  it('exports and erases one user without exposing credentials or affecting another school', async () => {
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

    const updateResponse = await request(app)
      .patch('/api/admin/schools/school-st-marys/users/user-stmarys-student')
      .set('Cookie', cookie)
      .send({ section: 'Ruby' });
    expect(updateResponse.status).toBe(200);

    const exportResponse = await request(app)
      .get('/api/admin/schools/school-st-marys/users/user-stmarys-student/export')
      .set('Cookie', cookie);
    expect(exportResponse.status).toBe(200);
    expect(exportResponse.body).toMatchObject({
      format: 'perl-user-export',
      school: { id: 'school-st-marys' },
      user: { id: 'user-stmarys-student', schoolId: 'school-st-marys' }
    });
    expect(exportResponse.body.attendanceLogs).toHaveLength(1);
    expect(exportResponse.body.auditRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'USER_UPDATED', targetId: 'user-stmarys-student' })
      ])
    );
    expect(JSON.stringify(exportResponse.body)).not.toContain('passwordHash');

    const eraseResponse = await request(app)
      .delete('/api/admin/schools/school-st-marys/users/user-stmarys-student/data')
      .set('Cookie', cookie)
      .send({ confirmEmail: 'student@stmarys.edu' });
    expect(eraseResponse.status).toBe(200);
    expect(eraseResponse.body.deleted).toEqual({ user: 1, attendanceLogs: 1 });

    const exportAfterErase = await request(app)
      .get('/api/admin/schools/school-st-marys/users/user-stmarys-student/export')
      .set('Cookie', cookie);
    expect(exportAfterErase.status).toBe(404);

    const otherSchoolLogin = await request(app).post('/api/auth/login').send({
      email: 'student@riversidetech.edu',
      password: 'Password123!',
      schoolSlug: 'riverside-tech'
    });
    expect(otherSchoolLogin.status).toBe(200);

    const auditResponse = await request(app)
      .get('/api/admin/schools/school-st-marys/audit-logs')
      .set('Cookie', cookie);
    expect(auditResponse.body.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'USER_DATA_EXPORTED', targetId: 'user-stmarys-student' }),
        expect.objectContaining({ action: 'USER_DATA_ERASED', targetId: 'user-stmarys-student' })
      ])
    );
  });

  it('exports portable data, deletes school data safely, and restores a single-school backup', async () => {
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

    const exportResponse = await request(app)
      .get('/api/admin/schools/school-st-marys/export')
      .set('Cookie', cookie);
    expect(exportResponse.status).toBe(200);
    expect(exportResponse.body.format).toBe('perl-school-export');
    expect(exportResponse.body.users).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'user-stmarys-admin' })])
    );
    expect(JSON.stringify(exportResponse.body)).not.toContain('passwordHash');
    expect(JSON.stringify(exportResponse.body)).not.toContain('keyHash');

    const backupResponse = await request(app)
      .get('/api/admin/schools/school-st-marys/backup')
      .set('Cookie', cookie);
    expect(backupResponse.status).toBe(200);
    expect(backupResponse.body.format).toBe('perl-school-backup');
    expect(backupResponse.body.users.length).toBeGreaterThan(1);
    expect(backupResponse.body.attendanceLogs.length).toBe(1);

    const backup = backupResponse.body;
    const invalidDeleteResponse = await request(app)
      .delete('/api/admin/schools/school-st-marys/data')
      .set('Cookie', cookie)
      .send({ confirmSlug: 'wrong-school' });
    expect(invalidDeleteResponse.status).toBe(400);

    const deleteResponse = await request(app)
      .delete('/api/admin/schools/school-st-marys/data')
      .set('Cookie', cookie)
      .send({ confirmSlug: 'st-marys' });
    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.deleted.users).toBeGreaterThan(0);

    const usersAfterDelete = await request(app)
      .get('/api/admin/schools/school-st-marys/users')
      .set('Cookie', cookie);
    expect(usersAfterDelete.status).toBe(200);
    expect(usersAfterDelete.body.users).toHaveLength(1);

    const devicesAfterDelete = await request(app)
      .get('/api/admin/schools/school-st-marys/devices')
      .set('Cookie', cookie);
    expect(devicesAfterDelete.body.devices).toHaveLength(0);

    const restoreResponse = await request(app)
      .post('/api/admin/schools/school-st-marys/restore')
      .set('Cookie', cookie)
      .send(backup);
    expect(restoreResponse.status).toBe(200);
    expect(restoreResponse.body).toMatchObject({
      restored: true,
      counts: {
        users: backup.users.length,
        devices: backup.devices.length,
        attendanceLogs: backup.attendanceLogs.length
      }
    });

    const restoredUsers = await request(app)
      .get('/api/admin/schools/school-st-marys/users')
      .set('Cookie', cookie);
    expect(restoredUsers.body.users).toHaveLength(backup.users.length);

    const auditResponse = await request(app)
      .get('/api/admin/schools/school-st-marys/audit-logs')
      .set('Cookie', cookie);
    expect(auditResponse.body.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'SCHOOL_DATA_EXPORTED' }),
        expect.objectContaining({ action: 'SCHOOL_BACKUP_CREATED' }),
        expect.objectContaining({ action: 'SCHOOL_DATA_ERASED' }),
        expect.objectContaining({ action: 'SCHOOL_BACKUP_RESTORED' })
      ])
    );
  });

  it('rolls back a school restore when the replacement snapshot cannot be applied', async () => {
    const app = createApp(createRepositories(dataLayer));
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'admin@stmarys.edu',
      password: 'Password123!',
      schoolSlug: 'st-marys'
    });
    const cookie = loginResponse.headers['set-cookie'][0];

    const backupResponse = await request(app)
      .get('/api/admin/schools/school-st-marys/backup')
      .set('Cookie', cookie);
    const invalidBackup = structuredClone(backupResponse.body);
    invalidBackup.users[1].id = 'user-riverside-student';

    const restoreResponse = await request(app)
      .post('/api/admin/schools/school-st-marys/restore')
      .set('Cookie', cookie)
      .send(invalidBackup);
    expect(restoreResponse.status).toBe(400);

    const usersAfterFailure = await request(app)
      .get('/api/admin/schools/school-st-marys/users')
      .set('Cookie', cookie);
    expect(usersAfterFailure.status).toBe(200);
    expect(usersAfterFailure.body.users).toHaveLength(backupResponse.body.users.length);

    const loginAfterFailure = await request(app).post('/api/auth/login').send({
      email: 'admin@stmarys.edu',
      password: 'Password123!',
      schoolSlug: 'st-marys'
    });
    expect(loginAfterFailure.status).toBe(200);
  });

  it('rejects malformed school backup records before replacing current data', async () => {
    const app = createApp(createRepositories(dataLayer));
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'admin@stmarys.edu',
      password: 'Password123!',
      schoolSlug: 'st-marys'
    });
    const cookie = loginResponse.headers['set-cookie'][0];
    const backupResponse = await request(app)
      .get('/api/admin/schools/school-st-marys/backup')
      .set('Cookie', cookie);
    const invalidBackup = structuredClone(backupResponse.body);
    invalidBackup.users[0].passwordHash = 'plaintext-password';

    const restoreResponse = await request(app)
      .post('/api/admin/schools/school-st-marys/restore')
      .set('Cookie', cookie)
      .send(invalidBackup);
    expect(restoreResponse.status).toBe(400);
    expect(restoreResponse.body.message).toBe('Backup contains invalid or cross-school records.');

    const usersAfterFailure = await request(app)
      .get('/api/admin/schools/school-st-marys/users')
      .set('Cookie', cookie);
    expect(usersAfterFailure.body.users).toHaveLength(backupResponse.body.users.length);
  });
});
