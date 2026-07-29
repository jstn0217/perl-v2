import mysql from 'mysql2/promise';
import type { Pool } from 'mysql2/promise';
import { env } from '../../config/env.js';

let pool: Pool | null = null;

const createPool = () =>
  mysql.createPool({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.name,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: 'Z',
    ssl: env.db.ssl ? { rejectUnauthorized: true } : undefined
  });

export const getDbPool = (): Pool => {
  pool ??= createPool();

  return pool;
};

export const closeDbPool = async () => {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = null;
};
