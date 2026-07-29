import { closeDbPool } from '../repositories/db/pool.js';
import { initializeDatabase, resetAndSeedDatabase } from '../repositories/db/schema.js';

const run = async () => {
  const shouldReset = process.argv.includes('--reset');

  if (shouldReset) {
    await resetAndSeedDatabase();
    console.log('Database reset and seed complete.');
  } else {
    await initializeDatabase();
    console.log('Database initialization complete.');
  }

  await closeDbPool();
};

run().catch(async (error) => {
  console.error('Database seed script failed:', error);
  await closeDbPool();
  process.exit(1);
});
