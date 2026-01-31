-- Enable pgvector extension on container startup
-- This runs before Drizzle migrations via docker-entrypoint-initdb.d
CREATE EXTENSION IF NOT EXISTS vector;
