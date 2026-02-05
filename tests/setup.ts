import { config } from 'dotenv';

config({ path: '.env' });

// Only require DATABASE_URL for integration tests
const isIntegrationTest = process.env.VITEST_POOL_ID !== undefined
  ? process.argv.some(arg => arg.includes('integration'))
  : false;

if (isIntegrationTest && !process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL must be set for integration tests.');
  process.exit(1);
}
