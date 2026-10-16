/**
 * Load test: boots the app in-process on the mock data layer, injects N
 * synthetic records directly at the repository layer (one shared bcrypt hash,
 * so seeding stays fast), then times the hot HTTP endpoints via supertest.
 *
 * Run: NODE_ENV=test DATA_LAYER=mock npx tsx scripts/load-test.ts [students]
 */
import request from 'supertest';
import bcrypt from 'bcrypt';
import { createApp } from '../src/app.js';
import { createRepositories, initializeRepositoryLayer } from '../src/repositories/index.js';

const STUDENTS = Number(process.argv[2] ?? 10000);
const GUARDIANS = Math.floor(STUDENTS / 2);
const ATTENDANCE = STUDENTS * 3;
const SUBMISSIONS = Math.floor(STUDENTS / 10);
const SCHOOL_ID = 'school-st-marys';

const sharedHash = bcrypt.hashSync('LoadTest123!', 4);

const time = async (label: string, fn: () => Promise<{ status: number; length?: number }>) => {
  const start = process.hrtime.bigint();
  const result = await fn();
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  console.log(
    `${label.padEnd(58)} ${ms.toFixed(1).padStart(9)} ms  status=${result.status}` +
      (result.length !== undefined ? ` items=${result.length}` : '')
  );
  return ms;
};

const main = async () => {
  await initializeRepositoryLayer();
  const repositories = createRepositories();
  const app = createApp(repositories);

  console.log(`Seeding: ${STUDENTS} students, ${GUARDIANS} guardians, ${ATTENDANCE} attendance, ${SUBMISSIONS} submissions...`);
  const seedStart = Date.now();

  for (let index = 0; index < STUDENTS; index += 1) {
    await repositories.userRepository.create({
      id: `lt-student-${index}`,
      schoolId: SCHOOL_ID,
      email: `lt.student${index}@stmarys.edu`,
      passwordHash: sharedHash,
      firstName: `Stu${index}`,
      lastName: `Perf${index % 500}`,
      role: 'STUDENT',
      cardUid: `LT-CARD-${index}`,
      gradeLevel: `Grade ${(index % 6) + 7}`,
      schoolIdNumber: `LT-${index}`,
      section: `Section ${index % 20}`,
      imageUrl: null,
      phoneNumber: null,
      isActive: index % 17 !== 0,
      addressLine1: `${index} Load St`,
      addressLine2: null,
      barangay: `Brgy ${index % 40}`,
      city: 'Quezon City',
      province: 'Metro Manila',
      zipCode: '1100'
    });
  }

  for (let index = 0; index < GUARDIANS; index += 1) {
    await repositories.userRepository.create({
      id: `lt-guardian-${index}`,
      schoolId: SCHOOL_ID,
      email: `lt.guardian${index}@stmarys.edu`,
      passwordHash: sharedHash,
      firstName: `Guard${index}`,
      lastName: `Perf${index % 500}`,
      role: 'GUARDIAN',
      cardUid: null,
      gradeLevel: null,
      schoolIdNumber: null,
      section: null,
      imageUrl: null,
      phoneNumber: '09170000000',
      linkedStudentIds: [`lt-student-${index * 2}`, `lt-student-${index * 2 + 1}`],
      isActive: true,
      addressLine1: null,
      addressLine2: null,
      barangay: null,
      city: null,
      province: null,
      zipCode: null
    });
  }

  const dayMs = 24 * 60 * 60 * 1000;
  for (let index = 0; index < ATTENDANCE; index += 1) {
    await repositories.attendanceRepository.create({
      schoolId: SCHOOL_ID,
      userId: `lt-student-${index % STUDENTS}`,
      deviceId: 'device-stmarys-gate',
      direction: index % 2 === 0 ? 'IN' : 'OUT',
      verdict: index % 23 === 0 ? 'DENIED' : 'ADMITTED',
      denialReason: index % 23 === 0 ? 'INACTIVE_USER' : null,
      message: 'Load test scan',
      scannedAt: new Date(Date.now() - (index % 30) * dayMs - (index % 86400) * 1000).toISOString()
    });
  }

  for (let index = 0; index < SUBMISSIONS; index += 1) {
    await repositories.submissionRepository.create({
      id: `lt-submission-${index}`,
      schoolId: SCHOOL_ID,
      type: index % 3 === 0 ? 'INQUIRY' : 'ENROLLMENT',
      status: (['NEW', 'IN_REVIEW', 'ACCEPTED', 'DECLINED'] as const)[index % 4],
      source: index % 5 === 0 ? 'MANUAL' : 'PUBLIC',
      firstName: `Applicant${index}`,
      lastName: `Perf${index % 100}`,
      email: `applicant${index}@example.com`,
      phone: null,
      addressLine1: null,
      addressLine2: null,
      barangay: null,
      city: null,
      province: null,
      zipCode: null,
      gradeLevelApplying: index % 3 === 0 ? null : 'Grade 7',
      guardianName: null,
      message: index % 3 === 0 ? 'Load test inquiry' : null,
      notes: null,
      createdAt: new Date(Date.now() - (index % 60) * dayMs).toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  console.log(`Seeded in ${((Date.now() - seedStart) / 1000).toFixed(1)}s\n`);

  const agent = request.agent(app);
  await time('POST /api/auth/login (bcrypt cost 12)', async () => {
    const res = await agent
      .post('/api/auth/login')
      .send({ email: 'admin@stmarys.edu', password: 'Password123!' });
    return { status: res.status };
  });

  const get = (label: string, url: string, items?: (body: unknown) => number | undefined) =>
    time(label, async () => {
      const res = await agent.get(url);
      return { status: res.status, length: items ? items(res.body) : undefined };
    });

  const bodyOf = (key: string) => (body: unknown) => {
    const value = (body as Record<string, unknown[]>)[key];
    return Array.isArray(value) ? value.length : undefined;
  };

  console.log('\n-- People (paginated list) --');
  await get('GET users page=1 size=25', `/api/admin/schools/${SCHOOL_ID}/users?page=1&pageSize=25`, bodyOf('users'));
  await get('GET users deep page (last)', `/api/admin/schools/${SCHOOL_ID}/users?page=${Math.ceil((STUDENTS + GUARDIANS) / 25)}&pageSize=25`, bodyOf('users'));
  await get('GET users search (rare term)', `/api/admin/schools/${SCHOOL_ID}/users?page=1&pageSize=25&search=Perf499`, bodyOf('users'));
  await get('GET users filter role+status', `/api/admin/schools/${SCHOOL_ID}/users?page=1&pageSize=25&role=STUDENT&status=inactive`, bodyOf('users'));

  console.log('\n-- Full-directory endpoints (known scale suspects) --');
  await get('GET users all=true role=STUDENT (link-picker feed)', `/api/admin/schools/${SCHOOL_ID}/users?role=STUDENT&all=true`, bodyOf('users'));
  await get('GET users all=true role=GUARDIAN', `/api/admin/schools/${SCHOOL_ID}/users?role=GUARDIAN&all=true`, bodyOf('users'));
  await get('GET assignable-roles', `/api/admin/schools/${SCHOOL_ID}/assignable-roles`, bodyOf('roles'));

  console.log('\n-- Attendance --');
  await get('GET attendance logs page=1 size=25', `/api/attendance/logs?page=1&pageSize=25`, bodyOf('records'));
  await get('GET attendance logs deep page', `/api/attendance/logs?page=${Math.ceil(ATTENDANCE / 25)}&pageSize=25`, bodyOf('records'));
  await get('GET attendance export CSV (7-day range)', `/api/attendance/export?from=${new Date(Date.now() - 7 * dayMs).toISOString()}&to=${new Date().toISOString()}`, undefined);

  console.log('\n-- Submissions --');
  await get('GET submissions page=1 size=25', `/api/admin/schools/${SCHOOL_ID}/submissions?page=1&pageSize=25`, bodyOf('submissions'));
  await get('GET submissions filtered', `/api/admin/schools/${SCHOOL_ID}/submissions?page=1&pageSize=25&type=ENROLLMENT&status=NEW`, bodyOf('submissions'));

  console.log('\n-- Writes --');
  await time('PATCH bulk-status 100 users', async () => {
    const ids = Array.from({ length: 100 }, (_, i) => `lt-student-${i}`);
    const res = await agent
      .patch(`/api/admin/schools/${SCHOOL_ID}/users/bulk-status`)
      .send({ userIds: ids, isActive: true });
    return { status: res.status };
  });
  await time('POST device scan (attendance write path)', async () => {
    const res = await request(app)
      .post('/api/device/scan')
      .set('x-device-key', 'seeded-device-key-stmarys')
      .send({ cardUid: 'LT-CARD-1', direction: 'IN' });
    return { status: res.status };
  });

  console.log('\n-- Dashboard --');
  await get('GET school summary (dashboard counts)', `/api/admin/schools/${SCHOOL_ID}/summary`, undefined);

  process.exit(0);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
