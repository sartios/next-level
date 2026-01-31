import assert from 'node:assert';
import { defineConfig } from 'drizzle-kit';

assert(process.env.DATABASE_URL, 'DATABASE_URL is not defined');

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL
  },
  verbose: true,
  strict: true
});
