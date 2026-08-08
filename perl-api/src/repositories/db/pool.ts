import pg from 'pg';
import { env } from '../../config/env.js';

let pool: pg.Pool | null = null;

const createPool = () =>
  new pg.Pool({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.name,
    max: 10,
    ssl: env.db.ssl ? { rejectUnauthorized: true } : undefined
  });

export const getDbPool = (): pg.Pool => {
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
