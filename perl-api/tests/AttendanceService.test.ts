import type { DataLayer } from '../src/config/env.js';
import { createRepositories } from '../src/repositories/index.js';
import { MockAttendanceRepository } from '../src/repositories/mock/MockAttendanceRepository.js';
import { MockDeviceRepository } from '../src/repositories/mock/MockDeviceRepository.js';
import { MockUserRepository } from '../src/repositories/mock/MockUserRepository.js';
import { AttendanceService } from '../src/services/AttendanceService.js';
import { describeForDataLayers } from './helpers/dataLayer.js';

const createService = (dataLayer: DataLayer) => {
  if (dataLayer === 'mock') {
    return new AttendanceService(new MockAttendanceRepository(), new MockDeviceRepository(), new MockUserRepository());
  }

  const repositories = createRepositories(dataLayer);

  return new AttendanceService(
    repositories.attendanceRepository,
    repositories.deviceRepository,
    repositories.userRepository
  );
};

describeForDataLayers('AttendanceService.scanCard', (dataLayer) => {
  it('admits the first valid scan as IN', async () => {
    const service = createService(dataLayer);

    const result = await service.scanCard('school-st-marys', 'RFID-STMARYS-001', '2026-07-22T08:00:00.000Z');

    expect(result).toMatchObject({
      schoolId: 'school-st-marys',
      verdict: 'ADMITTED',
      denialReason: null,
      log: {
        direction: 'IN'
      },
      student: {
        firstName: 'Lia',
        lastName: 'Garcia'
      }
    });
  });

  it.each([
    ['school admin', 'RFID-STMARYS-ADMIN', 'ADMIN'],
    ['staff member', 'RFID-STMARYS-STAFF', 'STAFF']
  ])('records attendance for a %s card', async (_label, cardUid, role) => {
    const service = createService(dataLayer);
    const result = await service.scanCard(
      'school-st-marys',
      cardUid,
      '2026-07-23T08:00:00.000Z'
    );

    expect(result).toMatchObject({
      verdict: 'ADMITTED',
      student: { role },
      log: { direction: 'IN', verdict: 'ADMITTED' }
    });
  });

  it('denies a second scan inside the cooldown window', async () => {
    const service = createService(dataLayer);

    await service.scanCard('school-st-marys', 'RFID-STMARYS-001', '2026-07-20T08:00:00.000Z');
    const result = await service.scanCard('school-st-marys', 'RFID-STMARYS-001', '2026-07-20T08:20:00.000Z');

    expect(result).toMatchObject({
      verdict: 'DENIED',
      denialReason: 'COOLDOWN_ACTIVE',
      log: {
        verdict: 'DENIED'
      }
    });
  });

  it('admits the second completed attendance scan as OUT after the cooldown', async () => {
    const service = createService(dataLayer);

    await service.scanCard('school-riverside', 'RFID-RIVERSIDE-001', '2026-07-19T08:00:00.000Z');
    const result = await service.scanCard('school-riverside', 'RFID-RIVERSIDE-001', '2026-07-19T08:31:00.000Z');

    expect(result).toMatchObject({
      verdict: 'ADMITTED',
      denialReason: null,
      log: {
        direction: 'OUT'
      }
    });
  });

  it('denies a third admitted scan after the daily limit is reached', async () => {
    const service = createService(dataLayer);

    await service.scanCard('school-golden', 'RFID-GOLDEN-001', '2026-07-18T08:00:00.000Z');
    await service.scanCard('school-golden', 'RFID-GOLDEN-001', '2026-07-18T08:31:00.000Z');
    const result = await service.scanCard('school-golden', 'RFID-GOLDEN-001', '2026-07-18T10:00:00.000Z');

    expect(result).toMatchObject({
      verdict: 'DENIED',
      denialReason: 'DAILY_LIMIT_REACHED',
      log: {
        verdict: 'DENIED'
      }
    });
  });

  it('denies a student card from another school', async () => {
    const service = createService(dataLayer);

    const result = await service.scanCard('school-st-marys', 'RFID-RIVERSIDE-001', '2026-07-17T08:00:00.000Z');

    expect(result).toMatchObject({
      verdict: 'DENIED',
      denialReason: 'CROSS_SCHOOL_USER',
      student: null,
      log: {
        message: 'Card not recognized for this school.'
      }
    });
    expect(JSON.stringify(result)).not.toContain('Riverside');
  });
});
