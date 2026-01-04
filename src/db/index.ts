import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

// Connection for queries with proper pooling for serverless
const queryClient = postgres(connectionString, {
  max: 1, // Serverless: keep connections minimal
  idle_timeout: 20, // Close idle connections after 20s
  connect_timeout: 10, // Fail fast if can't connect
});

export const db = drizzle(queryClient, { schema });

export * from './schema';
