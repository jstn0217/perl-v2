import type { PoolClient } from 'pg';
import {
  createMockDevices,
  createMockPlatformUsers,
  createMockSchools,
  createMockUsers
} from '../mock/seeds.js';
import { env } from '../../config/env.js';
import { getDbPool } from './pool.js';

let schemaReady = false;

// Postgres advisory locks take a bigint key, not a name. There is only ever one
// lock used in this codebase (database bootstrap), so a fixed constant is enough.
const initializationLockKey = 727384950;

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
      sms_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      sms_sender_name VARCHAR(32) NULL,
      address TEXT NULL,
      phone VARCHAR(32) NULL,
      timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Manila',
      academic_year_label VARCHAR(64) NULL,
      deped_school_id VARCHAR(64) NULL,
      features JSONB NOT NULL DEFAULT '{}',
      sort_order INT NOT NULL,
      created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
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
      student_id VARCHAR(255) NULL,
      section VARCHAR(255) NULL,
      image_url TEXT NULL,
      phone_number VARCHAR(32) NULL,
      linked_student_ids TEXT NULL,
      address TEXT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_users_school FOREIGN KEY (school_id) REFERENCES schools (id) ON DELETE CASCADE,
      CONSTRAINT uq_users_school_email UNIQUE (school_id, email)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS platform_users (
      id VARCHAR(128) PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      first_name VARCHAR(255) NOT NULL,
      last_name VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'SUPPORT',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS devices (
      id VARCHAR(128) PRIMARY KEY,
      school_id VARCHAR(128) NOT NULL,
      name VARCHAR(255) NOT NULL,
      location VARCHAR(255) NOT NULL,
      key_hash CHAR(64) NOT NULL UNIQUE,
      key_last_four CHAR(4) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_devices_school FOREIGN KEY (school_id) REFERENCES schools (id) ON DELETE CASCADE
    )
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
      scanned_at TIMESTAMPTZ(3) NOT NULL,
      created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_attendance_school FOREIGN KEY (school_id) REFERENCES schools (id) ON DELETE CASCADE
    )
  `);
  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_attendance_school_scanned_at ON attendance_logs (school_id, scanned_at DESC)'
  );
  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_attendance_user_scanned_at ON attendance_logs (user_id, scanned_at DESC)'
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(128) PRIMARY KEY,
      school_id VARCHAR(128) NOT NULL,
      actor_user_id VARCHAR(128) NOT NULL,
      actor_role VARCHAR(20) NOT NULL DEFAULT 'ADMIN',
      support_initiated BOOLEAN NOT NULL DEFAULT FALSE,
      action VARCHAR(64) NOT NULL,
      target_type VARCHAR(20) NOT NULL,
      target_id VARCHAR(128) NULL,
      change_summary TEXT NOT NULL,
      occurred_at TIMESTAMPTZ(3) NOT NULL,
      created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_audit_school FOREIGN KEY (school_id) REFERENCES schools (id) ON DELETE CASCADE
    )
  `);
  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_audit_school_occurred_at ON audit_logs (school_id, occurred_at DESC)'
  );

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
      created_at TIMESTAMPTZ(3) NOT NULL,
      completed_at TIMESTAMPTZ(3) NULL,
      CONSTRAINT fk_notification_school FOREIGN KEY (school_id) REFERENCES schools (id) ON DELETE CASCADE
    )
  `);
  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_notification_school_created_at ON notification_transactions (school_id, created_at DESC)'
  );
  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_notification_attendance_log ON notification_transactions (attendance_log_id)'
  );

  const ensureColumn = async (table: string, column: string, definition: string) => {
    const { rows } = await pool.query<{ column_name: string }>(
      'SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2',
      [table, column]
    );
    if (rows.length === 0) {
      await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  };

  await ensureColumn('users', 'linked_student_ids', 'TEXT NULL');
  await ensureColumn('users', 'phone_number', 'VARCHAR(32) NULL');
  await ensureColumn('users', 'student_id', 'VARCHAR(255) NULL');
  await ensureColumn('users', 'school_id_number', 'VARCHAR(255) NULL');
  await ensureColumn('users', 'address', 'TEXT NULL');
  await ensureColumn('schools', 'sms_enabled', 'BOOLEAN NOT NULL DEFAULT FALSE');
  await ensureColumn('schools', 'sms_sender_name', 'VARCHAR(32) NULL');
  await ensureColumn('schools', 'address', 'TEXT NULL');
  await ensureColumn('schools', 'phone', 'VARCHAR(32) NULL');
  await ensureColumn('schools', 'timezone', "VARCHAR(64) NOT NULL DEFAULT 'Asia/Manila'");
  await ensureColumn('schools', 'academic_year_label', 'VARCHAR(64) NULL');
  await ensureColumn('schools', 'deped_school_id', 'VARCHAR(64) NULL');
  await ensureColumn('schools', 'features', "JSONB NOT NULL DEFAULT '{}'");
  await pool.query(
    `UPDATE schools SET features = jsonb_set(features, '{sms}', to_jsonb(sms_enabled)) WHERE NOT (features ? 'sms')`
  );
  await pool.query(
    'UPDATE users SET school_id_number = student_id WHERE school_id_number IS NULL AND student_id IS NOT NULL'
  );
  await ensureColumn('platform_users', 'role', "VARCHAR(20) NOT NULL DEFAULT 'SUPPORT'");
  await ensureColumn('audit_logs', 'actor_role', "VARCHAR(20) NOT NULL DEFAULT 'ADMIN'");
  await ensureColumn('audit_logs', 'support_initiated', 'BOOLEAN NOT NULL DEFAULT FALSE');
  await ensureColumn('audit_logs', 'change_summary', 'TEXT NULL');
  await ensureColumn('devices', 'last_seen_at', 'TIMESTAMPTZ(3) NULL');

  await pool.query('CREATE INDEX IF NOT EXISTS idx_users_school ON users (school_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_users_school_role ON users (school_id, role)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_users_school_is_active ON users (school_id, is_active)');
  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_users_school_name ON users (school_id, last_name, first_name)'
  );
  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_users_school_student_id ON users (school_id, student_id)'
  );
  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_users_school_school_id_number ON users (school_id, school_id_number)'
  );
  await pool.query('CREATE INDEX IF NOT EXISTS idx_devices_school ON devices (school_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_devices_school_name ON devices (school_id, name)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_devices_school_location ON devices (school_id, location)');
};

const countSchools = async () => {
  const pool = getDbPool();
  const { rows } = await pool.query<{ total: string }>('SELECT COUNT(*) AS total FROM schools');

  return Number(rows[0]?.total ?? 0);
};

const seedMissingPlatformUsers = async () => {
  for (const platformUser of createMockPlatformUsers(
    env.initialSystemAdmin,
    env.initialSupport
  )) {
    await getDbPool().query(
      `INSERT INTO platform_users (
        id, email, password_hash, first_name, last_name, role, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (email) DO NOTHING`,
      [
        platformUser.id,
        platformUser.email,
        platformUser.passwordHash,
        platformUser.firstName,
        platformUser.lastName,
        platformUser.role,
        platformUser.isActive
      ]
    );
  }
};

const withAdvisoryLock = async <T>(callback: () => Promise<T>) => {
  const client = await getDbPool().connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [initializationLockKey]);

    try {
      return await callback();
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [initializationLockKey]);
    }
  } finally {
    client.release();
  }
};

export const ensureDatabaseReady = async () => {
  if (schemaReady) {
    return;
  }

  await createTables();
  schemaReady = true;
};

const insertSchools = async (client: PoolClient) => {
  const schools = createMockSchools();
  for (const [index, school] of schools.entries()) {
    await client.query(
      `INSERT INTO schools (
        id, slug, name, logo_url, primary_color, secondary_color, accent_color,
        contact_email, sms_enabled, sms_sender_name, address, phone, timezone,
        academic_year_label, deped_school_id, features, sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        school.id,
        school.slug,
        school.name,
        school.logoUrl,
        school.theme.primaryColor,
        school.theme.secondaryColor,
        school.theme.accentColor,
        school.contactEmail,
        school.smsEnabled,
        school.smsSenderName,
        school.address,
        school.phone,
        school.timezone,
        school.academicYearLabel,
        school.depedSchoolId,
        JSON.stringify(school.features),
        index + 1
      ]
    );
  }
};

const insertUsers = async (client: PoolClient) => {
  for (const user of createMockUsers()) {
    await client.query(
      `INSERT INTO users (
        id, school_id, email, password_hash, first_name, last_name, role, card_uid,
        grade_level, school_id_number, section, image_url, phone_number, linked_student_ids, address, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
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
        user.schoolIdNumber,
        user.section,
        user.imageUrl,
        user.phoneNumber ?? null,
        JSON.stringify(user.linkedStudentIds ?? []),
        user.address,
        user.isActive
      ]
    );
  }
};

const insertPlatformUsers = async (client: PoolClient) => {
  for (const platformUser of createMockPlatformUsers(
    env.initialSystemAdmin,
    env.initialSupport
  )) {
    await client.query(
      `INSERT INTO platform_users (
        id, email, password_hash, first_name, last_name, role, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        platformUser.id,
        platformUser.email,
        platformUser.passwordHash,
        platformUser.firstName,
        platformUser.lastName,
        platformUser.role,
        platformUser.isActive
      ]
    );
  }
};

const insertDevices = async (client: PoolClient) => {
  for (const device of createMockDevices()) {
    await client.query(
      `INSERT INTO devices (
        id, school_id, name, location, key_hash, key_last_four, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        device.id,
        device.schoolId,
        device.name,
        device.location,
        device.keyHash,
        device.keyLastFour,
        device.isActive
      ]
    );
  }
};

export const seedDatabase = async () => {
  await ensureDatabaseReady();

  const client = await getDbPool().connect();

  try {
    await client.query('BEGIN');
    await insertSchools(client);
    await insertUsers(client);
    await insertPlatformUsers(client);
    await insertDevices(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
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

  const client = await getDbPool().connect();

  try {
    await client.query('BEGIN');
    // Postgres checks FK constraints against the full statement, not truncation order,
    // so every table on either side of a foreign key must be truncated together.
    await client.query(
      `TRUNCATE TABLE
        notification_transactions, audit_logs, attendance_logs, devices, users, platform_users, schools`
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const resetAndSeedDatabase = async () => {
  await withAdvisoryLock(async () => {
    await resetDatabase();
    await seedDatabase();
  });
};
