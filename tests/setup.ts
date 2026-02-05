import { config } from 'dotenv';

config({ path: '.env' });

// Detect integration tests via:
// 1. Explicit environment variable (most reliable)
// 2. Test file path containing 'integration' (fallback)
const isIntegrationTest =
  process.env.INTEGRATION_TEST === 'true' ||
  process.argv.some((arg) => arg.includes('integration'));

// Only require DATABASE_URL for integration tests
if (isIntegrationTest && !process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL must be set for integration tests.');
  console.error('Set INTEGRATION_TEST=false to skip this check for unit tests.');
  process.exit(1);
}
