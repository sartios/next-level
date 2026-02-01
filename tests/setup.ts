import { config } from 'dotenv';

config({ path: '.env' });

if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL must be set for integration tests.');
  process.exit(1);
}
