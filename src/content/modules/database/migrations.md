# Database Migrations

> Copy-paste ready. Manage schema changes with Drizzle Kit.

## Setup

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

## Package.json Scripts

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:drop": "drizzle-kit drop"
  }
}
```

## Workflow

### 1. Make Schema Changes

```typescript
// lib/db/schema.ts
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  // ADD NEW COLUMN
  bio: text('bio'),
});
```

### 2. Generate Migration

```bash
npm run db:generate
```

This creates a migration file in `./drizzle/`:

```sql
-- drizzle/0001_add_bio_column.sql
ALTER TABLE "users" ADD COLUMN "bio" text;
```

### 3. Apply Migration

```bash
npm run db:migrate
```

## Migration with Default Values

```typescript
// When adding a NOT NULL column to existing table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  // New NOT NULL column with default
  status: text('status').notNull().default('active'),
});
```

```sql
-- Generated migration handles existing rows
ALTER TABLE "users" ADD COLUMN "status" text NOT NULL DEFAULT 'active';
```

## Custom Migration Script

```typescript
// scripts/migrate.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const runMigrations = async () => {
  const connection = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(connection);

  console.log('Running migrations...');

  await migrate(db, { migrationsFolder: './drizzle' });

  console.log('Migrations complete!');

  await connection.end();
};

runMigrations().catch(console.error);
```

```json
{
  "scripts": {
    "db:migrate:run": "tsx scripts/migrate.ts"
  }
}
```

## Seed Data

```typescript
// scripts/seed.ts
import { db, users, posts } from '@/lib/db';

async function seed() {
  console.log('Seeding database...');

  // Clear existing data (careful in production!)
  await db.delete(posts);
  await db.delete(users);

  // Create users
  const [user1, user2] = await db
    .insert(users)
    .values([
      { email: 'admin@example.com', name: 'Admin', role: 'admin' },
      { email: 'user@example.com', name: 'User', role: 'user' },
    ])
    .returning();

  // Create posts
  await db.insert(posts).values([
    { title: 'First Post', content: 'Hello world!', authorId: user1.id, published: true },
    { title: 'Draft Post', content: 'Work in progress', authorId: user2.id, published: false },
  ]);

  console.log('Seeding complete!');
}

seed().catch(console.error);
```

```json
{
  "scripts": {
    "db:seed": "tsx scripts/seed.ts"
  }
}
```

## Development vs Production

```typescript
// For development - push changes directly (no migration files)
// npm run db:push

// For production - generate and apply migrations
// npm run db:generate
// npm run db:migrate
```

## Check Migration Status

```bash
# See pending migrations
npx drizzle-kit check

# Open Drizzle Studio to inspect database
npm run db:studio
```

## Rollback (Manual)

```sql
-- Drizzle doesn't auto-generate rollbacks
-- Create a new migration to reverse changes

-- Example: Remove a column
ALTER TABLE "users" DROP COLUMN "bio";
```

## Environment Variables

```bash
# .env.local (development)
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb

# .env.production
DATABASE_URL=postgresql://user:pass@production-host:5432/mydb
```

## CI/CD Integration

```yaml
# .github/workflows/deploy.yml
jobs:
  deploy:
    steps:
      - uses: actions/checkout@v4

      - name: Install dependencies
        run: npm ci

      - name: Run migrations
        run: npm run db:migrate
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Deploy
        run: npm run deploy
```

## Usage
Always generate migrations in development, then apply in production. Never use `db:push` in production.
