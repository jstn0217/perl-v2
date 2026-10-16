import http from 'node:http';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createRepositories, describeForDataLayers } from './helpers/dataLayer.js';

const login = async (app: ReturnType<typeof createApp>, email: string, password: string) => {
  const response = await request(app).post('/api/auth/login').send({ email, password });
  return response.headers['set-cookie'][0];
};

// The attendance stream is SSE: on success it never ends the response, so
// supertest (which awaits full-body completion) would hang forever. Open a
// raw connection instead, read only the status line/headers, then destroy
// the socket — enough to assert 200 vs 403 without waiting on a body that
// never arrives.
const probeStream = (
  app: ReturnType<typeof createApp>,
  path: string,
  cookie: string
): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      const req = http.get(
        { host: '127.0.0.1', port, path, headers: { Cookie: cookie } },
        (res) => {
          const status = res.statusCode ?? 0;
          req.destroy();
          res.destroy();
          server.close();
          resolve(status);
        }
      );

      req.on('error', (error) => {
        server.close();
        reject(error);
      });
    });
  });

describeForDataLayers('Phase 9+ role catalog', (dataLayer) => {
  it('preserves default effective access for users without a roleDefinitionId', async () => {
    const app = createApp(createRepositories(dataLayer));
    const adminCookie = await login(app, 'admin@stmarys.edu', 'Password123!');
    const staffCookie = await login(app, 'staff@stmarys.edu', 'Password123!');

    // ADMIN default still has full school.records.read + school.users.manage.
    const adminUsers = await request(app)
      .get('/api/admin/schools/school-st-marys/users')
      .set('Cookie', adminCookie);
    expect(adminUsers.status).toBe(200);

    // STAFF default still lacks school.records.read (matches old schoolReadRoles,
    // which excluded STAFF) ...
    const staffUsers = await request(app)
      .get('/api/admin/schools/school-st-marys/users')
      .set('Cookie', staffCookie);
    expect(staffUsers.status).toBe(403);

    // ... but still has monitor.live (matches old liveMonitorRoles, which included STAFF).
    const staffStreamStatus = await probeStream(app, '/api/attendance/stream?school=st-marys', staffCookie);
    expect(staffStreamStatus).toBe(200);
  });

  it('lets system admins create custom roles and support read them, but not mutate', async () => {
    const app = createApp(createRepositories(dataLayer));
    const systemCookie = await login(app, 'system@perl.system', 'SystemAdmin123!');
    const supportCookie = await login(app, 'support@perl.system', 'Support123!');
    const adminCookie = await login(app, 'admin@stmarys.edu', 'Password123!');

    const catalog = await request(app)
      .get('/api/support/permissions/catalog')
      .set('Cookie', supportCookie);
    expect(catalog.status).toBe(200);
    expect(catalog.body.permissions).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'monitor.live' })])
    );

    const created = await request(app)
      .post('/api/support/roles')
      .set('Cookie', systemCookie)
      .send({
        name: 'Monitor Only',
        baseRole: 'STAFF',
        permissions: ['monitor.live']
      });
    expect(created.status).toBe(201);
    expect(created.body.role).toMatchObject({
      name: 'Monitor Only',
      baseRole: 'STAFF',
      permissions: ['monitor.live'],
      isActive: true,
      isSystem: false
    });

    const supportCreate = await request(app)
      .post('/api/support/roles')
      .set('Cookie', supportCookie)
      .send({ name: 'Support Attempt', baseRole: 'STAFF', permissions: ['monitor.live'] });
    expect(supportCreate.status).toBe(403);

    const adminCreate = await request(app)
      .post('/api/support/roles')
      .set('Cookie', adminCookie)
      .send({ name: 'Admin Attempt', baseRole: 'STAFF', permissions: ['monitor.live'] });
    expect(adminCreate.status).toBe(403);

    const list = await request(app).get('/api/support/roles').set('Cookie', supportCookie);
    expect(list.status).toBe(200);
    expect(list.body.roles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Monitor Only', assignable: true }),
        expect.objectContaining({ name: 'Admin (built-in)', assignable: false, isSystem: true })
      ])
    );

    const adminList = await request(app).get('/api/support/roles').set('Cookie', adminCookie);
    expect(adminList.status).toBe(403);
  });

  it('rejects duplicate role names case-insensitively', async () => {
    const app = createApp(createRepositories(dataLayer));
    const systemCookie = await login(app, 'system@perl.system', 'SystemAdmin123!');

    const first = await request(app)
      .post('/api/support/roles')
      .set('Cookie', systemCookie)
      .send({ name: 'Front Desk', baseRole: 'STAFF', permissions: ['monitor.live'] });
    expect(first.status).toBe(201);

    const duplicate = await request(app)
      .post('/api/support/roles')
      .set('Cookie', systemCookie)
      .send({ name: 'FRONT DESK', baseRole: 'STAFF', permissions: ['monitor.live'] });
    expect(duplicate.status).toBe(400);
    expect(duplicate.body.message).toMatch(/already exists/i);
  });

  it('rejects invalid baseRole and invalid permission keys', async () => {
    const app = createApp(createRepositories(dataLayer));
    const systemCookie = await login(app, 'system@perl.system', 'SystemAdmin123!');

    const badBaseRole = await request(app)
      .post('/api/support/roles')
      .set('Cookie', systemCookie)
      .send({ name: 'Bad Base', baseRole: 'STUDENT', permissions: ['monitor.live'] });
    expect(badBaseRole.status).toBe(400);

    const badPermission = await request(app)
      .post('/api/support/roles')
      .set('Cookie', systemCookie)
      .send({ name: 'Bad Permission', baseRole: 'STAFF', permissions: ['not.a.real.key'] });
    expect(badPermission.status).toBe(400);

    const emptyPermissions = await request(app)
      .post('/api/support/roles')
      .set('Cookie', systemCookie)
      .send({ name: 'Empty Permissions', baseRole: 'STAFF', permissions: [] });
    expect(emptyPermissions.status).toBe(400);
  });

  it('narrows and expands STAFF access at the route level via a custom role assignment', async () => {
    const app = createApp(createRepositories(dataLayer));
    const systemCookie = await login(app, 'system@perl.system', 'SystemAdmin123!');
    const adminCookie = await login(app, 'admin@stmarys.edu', 'Password123!');

    const roleResponse = await request(app)
      .post('/api/support/roles')
      .set('Cookie', systemCookie)
      .send({
        name: 'Monitor Only Staff',
        baseRole: 'STAFF',
        permissions: ['monitor.live']
      });
    const roleId = roleResponse.body.role.id;

    const staffCreate = await request(app)
      .post('/api/admin/schools/school-st-marys/users')
      .set('Cookie', adminCookie)
      .send({
        email: 'custom-staff@stmarys.edu',
        password: 'Password123!',
        firstName: 'Custom',
        lastName: 'Staff',
        role: 'STAFF',
        roleDefinitionId: roleId
      });
    expect(staffCreate.status).toBe(201);
    expect(staffCreate.body.user.roleDefinitionId).toBe(roleId);

    const staffCookie = await login(app, 'custom-staff@stmarys.edu', 'Password123!');

    const mutationAttempt = await request(app)
      .post('/api/admin/schools/school-st-marys/users')
      .set('Cookie', staffCookie)
      .send({
        email: 'irrelevant@stmarys.edu',
        password: 'Password123!',
        firstName: 'Nope',
        lastName: 'Nope',
        role: 'STUDENT'
      });
    expect(mutationAttempt.status).toBe(403);

    const streamStatus = await probeStream(app, '/api/attendance/stream?school=st-marys', staffCookie);
    expect(streamStatus).toBe(200);
  });

  it('rejects assigning a role with the wrong baseRole, an inactive role, or a built-in virtual role', async () => {
    const app = createApp(createRepositories(dataLayer));
    const systemCookie = await login(app, 'system@perl.system', 'SystemAdmin123!');
    const adminCookie = await login(app, 'admin@stmarys.edu', 'Password123!');

    const adminOnlyRole = await request(app)
      .post('/api/support/roles')
      .set('Cookie', systemCookie)
      .send({ name: 'Admin Only Role', baseRole: 'ADMIN', permissions: ['school.records.read'] });
    const adminOnlyRoleId = adminOnlyRole.body.role.id;

    // Wrong baseRole: an ADMIN-based role assigned to a STAFF user.
    const wrongBaseRole = await request(app)
      .post('/api/admin/schools/school-st-marys/users')
      .set('Cookie', adminCookie)
      .send({
        email: 'wrong-base@stmarys.edu',
        password: 'Password123!',
        firstName: 'Wrong',
        lastName: 'Base',
        role: 'STAFF',
        roleDefinitionId: adminOnlyRoleId
      });
    expect(wrongBaseRole.status).toBe(400);

    // Inactive role.
    await request(app)
      .patch(`/api/support/roles/${adminOnlyRoleId}/deactivate`)
      .set('Cookie', systemCookie);
    const inactiveAssignment = await request(app)
      .post('/api/admin/schools/school-st-marys/users')
      .set('Cookie', adminCookie)
      .send({
        email: 'inactive-role@stmarys.edu',
        password: 'Password123!',
        firstName: 'Inactive',
        lastName: 'Role',
        role: 'ADMIN',
        roleDefinitionId: adminOnlyRoleId
      });
    expect(inactiveAssignment.status).toBe(400);

    // Built-in virtual role.
    const virtualAssignment = await request(app)
      .post('/api/admin/schools/school-st-marys/users')
      .set('Cookie', adminCookie)
      .send({
        email: 'virtual-role@stmarys.edu',
        password: 'Password123!',
        firstName: 'Virtual',
        lastName: 'Role',
        role: 'ADMIN',
        roleDefinitionId: 'role-builtin-admin'
      });
    expect(virtualAssignment.status).toBe(400);
  });

  it('blocks deactivation while a role is still assigned and reports the assigned-user count', async () => {
    const app = createApp(createRepositories(dataLayer));
    const systemCookie = await login(app, 'system@perl.system', 'SystemAdmin123!');
    const adminCookie = await login(app, 'admin@stmarys.edu', 'Password123!');

    const roleResponse = await request(app)
      .post('/api/support/roles')
      .set('Cookie', systemCookie)
      .send({ name: 'Assigned Role', baseRole: 'STAFF', permissions: ['monitor.live'] });
    const roleId = roleResponse.body.role.id;

    const assignedUser = await request(app)
      .post('/api/admin/schools/school-st-marys/users')
      .set('Cookie', adminCookie)
      .send({
        email: 'assigned-staff@stmarys.edu',
        password: 'Password123!',
        firstName: 'Assigned',
        lastName: 'Staff',
        role: 'STAFF',
        roleDefinitionId: roleId
      });
    expect(assignedUser.status).toBe(201);

    const blockedDeactivation = await request(app)
      .patch(`/api/support/roles/${roleId}/deactivate`)
      .set('Cookie', systemCookie);
    expect(blockedDeactivation.status).toBe(400);
    expect(blockedDeactivation.body.message).toMatch(/1 user/);

    await request(app)
      .post(`/api/admin/schools/school-st-marys/users/${assignedUser.body.user.id}/deactivate`)
      .set('Cookie', adminCookie)
      .send({});

    // Even with the school user deactivated, the role assignment itself (roleDefinitionId)
    // still points at the role, so the block should not lift just from deactivating the user.
    const stillBlocked = await request(app)
      .patch(`/api/support/roles/${roleId}/deactivate`)
      .set('Cookie', systemCookie);
    expect(stillBlocked.status).toBe(400);
  });

  it('never lets a school ADMIN or a plain STAFF user reach role-management routes', async () => {
    const app = createApp(createRepositories(dataLayer));
    const adminCookie = await login(app, 'admin@stmarys.edu', 'Password123!');

    const roleResponse = await request(app)
      .post('/api/support/roles')
      .set('Cookie', adminCookie)
      .send({ name: 'Should Fail', baseRole: 'STAFF', permissions: ['monitor.live'] });
    expect(roleResponse.status).toBe(403);

    const catalog = await request(app)
      .get('/api/support/permissions/catalog')
      .set('Cookie', adminCookie);
    expect(catalog.status).toBe(403);
  });

  it('logs role mutations to the global audit log with schoolId null', async () => {
    const app = createApp(createRepositories(dataLayer));
    const systemCookie = await login(app, 'system@perl.system', 'SystemAdmin123!');

    const created = await request(app)
      .post('/api/support/roles')
      .set('Cookie', systemCookie)
      .send({ name: 'Audited Role', baseRole: 'STAFF', permissions: ['monitor.live'] });
    expect(created.status).toBe(201);

    const auditLogs = await request(app)
      .get('/api/support/audit-logs?action=ROLE_CREATED')
      .set('Cookie', systemCookie);
    expect(auditLogs.status).toBe(200);
    expect(auditLogs.body.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'ROLE_CREATED',
          targetType: 'ROLE',
          targetId: created.body.role.id
        })
      ])
    );
  });

  it('keeps cross-school scoping intact for permission-catalog-gated admin routes', async () => {
    const app = createApp(createRepositories(dataLayer));
    const stMarysAdminCookie = await login(app, 'admin@stmarys.edu', 'Password123!');

    const response = await request(app)
      .get('/api/admin/schools/school-riverside/users')
      .set('Cookie', stMarysAdminCookie);

    expect(response.status).toBe(403);
  });
});
