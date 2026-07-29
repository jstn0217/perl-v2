import type { RowDataPacket } from 'mysql2';
import {
  createMockDevices,
  createMockPlatformUsers,
  createMockSchools,
  createMockUsers
} from '../mock/seeds.js';
import { env } from '../../config/env.js';
import { getDbPool } from './pool.js';

let schemaReady = false;
const initializationLockName = 'perl_db_bootstrap_lock';

const createTables = async () => {
  const pool = getDbPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schools (
      id VARCHAR(128) PRIMARY KEY,
      slug VARCHAR(128) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      logo_url TEXT NULL,
      primary_color CHAR(7) NOT NULL,
      secondary_color CHAR(7) NOT NULL,
      accent_color CHAR(7) NOT NULL,
      contact_email VARCHAR(255) NOT NULL,
      sms_enabled TINYINT(1) NOT NULL DEFAULT 0,
      sms_sender_name VARCHAR(32) NULL,
      sort_order INT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(128) PRIMARY KEY,
      school_id VARCHAR(128) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      first_name VARCHAR(255) NOT NULL,
      last_name VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL,
      card_uid VARCHAR(255) NULL UNIQUE,
      grade_level VARCHAR(255) NULL,
      section VARCHAR(255) NULL,
      image_url TEXT NULL,
      phone_number VARCHAR(32) NULL,
      linked_student_ids TEXT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_users_school FOREIGN KEY (school_id) REFERENCES schools (id) ON DELETE CASCADE,
      CONSTRAINT uq_users_school_email UNIQUE (school_id, email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS platform_users (
      id VARCHAR(128) PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      first_name VARCHAR(255) NOT NULL,
      last_name VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'SUPPORT',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS devices (
      id VARCHAR(128) PRIMARY KEY,
      school_id VARCHAR(128) NOT NULL,
      name VARCHAR(255) NOT NULL,
      location VARCHAR(255) NOT NULL,
      key_hash CHAR(64) NOT NULL UNIQUE,
      key_last_four CHAR(4) NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_devices_school FOREIGN KEY (school_id) REFERENCES schools (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS attendance_logs (
      id VARCHAR(128) PRIMARY KEY,
      school_id VARCHAR(128) NOT NULL,
      user_id VARCHAR(128) NOT NULL,
      device_id VARCHAR(128) NOT NULL,
      direction VARCHAR(10) NOT NULL,
      verdict VARCHAR(20) NOT NULL,
      denial_reason VARCHAR(64) NULL,
      message TEXT NOT NULL,
      scanned_at DATETIME(3) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_attendance_school FOREIGN KEY (school_id) REFERENCES schools (id) ON DELETE CASCADE,
      INDEX idx_attendance_school_scanned_at (school_id, scanned_at DESC),
      INDEX idx_attendance_user_scanned_at (user_id, scanned_at DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(128) PRIMARY KEY,
      school_id VARCHAR(128) NOT NULL,
      actor_user_id VARCHAR(128) NOT NULL,
      actor_role VARCHAR(20) NOT NULL DEFAULT 'ADMIN',
      support_initiated TINYINT(1) NOT NULL DEFAULT 0,
      action VARCHAR(64) NOT NULL,
      target_type VARCHAR(20) NOT NULL,
      target_id VARCHAR(128) NULL,
      change_summary TEXT NOT NULL,
      occurred_at DATETIME(3) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_audit_school FOREIGN KEY (school_id) REFERENCES schools (id) ON DELETE CASCADE,
      INDEX idx_audit_school_occurred_at (school_id, occurred_at DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_transactions (
      id VARCHAR(128) PRIMARY KEY,
      school_id VARCHAR(128) NOT NULL,
      attendance_log_id VARCHAR(128) NOT NULL,
      student_user_id VARCHAR(128) NOT NULL,
      guardian_user_id VARCHAR(128) NULL,
      recipient VARCHAR(32) NULL,
      direction VARCHAR(8) NOT NULL,
      message TEXT NOT NULL,
      provider VARCHAR(20) NOT NULL,
      status VARCHAR(20) NOT NULL,
      provider_message_id VARCHAR(128) NULL,
      provider_status VARCHAR(64) NULL,
      network VARCHAR(64) NULL,
      error_message TEXT NULL,
      created_at DATETIME(3) NOT NULL,
      completed_at DATETIME(3) NULL,
      CONSTRAINT fk_notification_school FOREIGN KEY (school_id) REFERENCES schools (id) ON DELETE CASCADE,
      INDEX idx_notification_school_created_at (school_id, created_at DESC),
      INDEX idx_notification_attendance_log (attendance_log_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const ensureColumn = async (table: string, column: string, definition: string) => {
    const [rows] = await pool.query<RowDataPacket[]>(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
    if (rows.length === 0) {
      await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    }
  };

  await ensureColumn('users', 'linked_student_ids', 'TEXT NULL');
  await ensureColumn('users', 'phone_number', 'VARCHAR(32) NULL');
  await ensureColumn('schools', 'sms_enabled', 'TINYINT(1) NOT NULL DEFAULT 0');
  await ensureColumn('schools', 'sms_sender_name', 'VARCHAR(32) NULL');
  await ensureColumn('platform_users', 'role', "VARCHAR(20) NOT NULL DEFAULT 'SUPPORT'");
  await ensureColumn('audit_logs', 'actor_role', "VARCHAR(20) NOT NULL DEFAULT 'ADMIN'");
  await ensureColumn('audit_logs', 'support_initiated', 'TINYINT(1) NOT NULL DEFAULT 0');
  await ensureColumn('audit_logs', 'change_summary', 'TEXT NULL');
};

const countSchools = async () => {
  const pool = getDbPool();
  const [rows] = await pool.query<(RowDataPacket & { total: number })[]>('SELECT COUNT(*) AS total FROM schools');

  return rows[0]?.total ?? 0;
};

const seedMissingPlatformUsers = async () => {
  for (const platformUser of createMockPlatformUsers(
    env.initialSystemAdmin,
    env.initialSupport
  )) {
    await getDbPool().query(
      `INSERT IGNORE INTO platform_users (
        id, email, password_hash, first_name, last_name, role, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        platformUser.id,
        platformUser.email,
        platformUser.passwordHash,
        platformUser.firstName,
        platformUser.lastName,
        platformUser.role,
        platformUser.isActive ? 1 : 0
      ]
    );
  }
};

const withAdvisoryLock = async <T>(callback: () => Promise<T>) => {
  const pool = getDbPool();
  const [lockRows] = await pool.query<(RowDataPacket & { acquired: number | null })[]>(
    'SELECT GET_LOCK(?, 30) AS acquired',
    [initializationLockName]
  );

  if (lockRows[0]?.acquired !== 1) {
    throw new Error('Unable to acquire database bootstrap lock.');
  }

  try {
    return await callback();
  } finally {
    await pool.query('DO RELEASE_LOCK(?)', [initializationLockName]);
  }
};

export const ensureDatabaseReady = async () => {
  if (schemaReady) {
    return;
  }

  await createTables();
  schemaReady = true;
};

export const seedDatabase = async () => {
  await ensureDatabaseReady();

  const pool = getDbPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const schools = createMockSchools();
    for (const [index, school] of schools.entries()) {
      await connection.query(
        `INSERT INTO schools (
          id, slug, name, logo_url, primary_color, secondary_color, accent_color,
          contact_email, sms_enabled, sms_sender_name, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          school.id,
          school.slug,
          school.name,
          school.logoUrl,
          school.theme.primaryColor,
          school.theme.secondaryColor,
          school.theme.accentColor,
          school.contactEmail,
          school.smsEnabled ? 1 : 0,
          school.smsSenderName,
          index + 1
        ]
      );
    }

    for (const user of createMockUsers()) {
      await connection.query(
        `INSERT INTO users (
          id, school_id, email, password_hash, first_name, last_name, role, card_uid,
          grade_level, section, image_url, phone_number, linked_student_ids, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user.id,
          user.schoolId,
          user.email,
          user.passwordHash,
          user.firstName,
          user.lastName,
          user.role,
          user.cardUid,
          user.gradeLevel,
          user.section,
          user.imageUrl,
          user.phoneNumber ?? null,
          JSON.stringify(user.linkedStudentIds ?? []),
          user.isActive ? 1 : 0
        ]
      );
    }

    for (const platformUser of createMockPlatformUsers(
      env.initialSystemAdmin,
      env.initialSupport
    )) {
      await connection.query(
        `INSERT INTO platform_users (
          id, email, password_hash, first_name, last_name, role, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          platformUser.id,
          platformUser.email,
          platformUser.passwordHash,
          platformUser.firstName,
          platformUser.lastName,
          platformUser.role,
          platformUser.isActive ? 1 : 0
        ]
      );
    }

    for (const device of createMockDevices()) {
      await connection.query(
        `INSERT INTO devices (
          id, school_id, name, location, key_hash, key_last_four, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          device.id,
          device.schoolId,
          device.name,
          device.location,
          device.keyHash,
          device.keyLastFour,
          device.isActive ? 1 : 0
        ]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const initializeDatabase = async () => {
  await withAdvisoryLock(async () => {
    await ensureDatabaseReady();

    if ((await countSchools()) === 0) {
      await seedDatabase();
    }
    await seedMissingPlatformUsers();
  });
};

export const resetDatabase = async () => {
  await ensureDatabaseReady();

  const pool = getDbPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query('TRUNCATE TABLE notification_transactions');
    await connection.query('TRUNCATE TABLE audit_logs');
    await connection.query('TRUNCATE TABLE attendance_logs');
    await connection.query('TRUNCATE TABLE devices');
    await connection.query('TRUNCATE TABLE users');
    await connection.query('TRUNCATE TABLE platform_users');
    await connection.query('TRUNCATE TABLE schools');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const resetAndSeedDatabase = async () => {
  await withAdvisoryLock(async () => {
    await resetDatabase();
    await seedDatabase();
  });
};
