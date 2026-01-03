# DATABASE EDGE CASES
# Module: 01a-database-edge-cases.md
# Load with: 00-core.md, 01-database.md
# Covers: Transactions, migrations, soft delete, connection pooling, deadlocks

---

## 🔄 TRANSACTION EDGE CASES

```typescript
// lib/db/transactions.ts
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export interface TransactionOptions {
  isolationLevel?: 'read_uncommitted' | 'read_committed' | 'repeatable_read' | 'serializable';
  timeout?: number;
  retryOnSerializationFailure?: boolean;
  maxRetries?: number;
}

/**
 * Execute transaction with retry on serialization failure
 */
export async function withTransaction<T>(
  operation: (tx: typeof db) => Promise<T>,
  options: TransactionOptions = {}
): Promise<T> {
  const {
    isolationLevel = 'read_committed',
    timeout = 30000,
    retryOnSerializationFailure = true,
    maxRetries = 3,
  } = options;

  let attempts = 0;

  while (true) {
    attempts++;

    try {
      return await db.transaction(async (tx) => {
        // Set isolation level
        if (isolationLevel !== 'read_committed') {
          await tx.execute(
            sql`SET TRANSACTION ISOLATION LEVEL ${sql.raw(isolationLevel.replace('_', ' ').toUpperCase())}`
          );
        }

        // Set timeout
        await tx.execute(
          sql`SET LOCAL statement_timeout = ${timeout}`
        );

        return await operation(tx);
      });
    } catch (error) {
      // Check for serialization failure (PostgreSQL error code 40001)
      const isSerializationFailure =
        error instanceof Error &&
        (error as any).code === '40001';

      if (isSerializationFailure && retryOnSerializationFailure && attempts < maxRetries) {
        // Wait with exponential backoff
        await new Promise((r) => setTimeout(r, Math.pow(2, attempts) * 100));
        continue;
      }

      throw error;
    }
  }
}

/**
 * Handle long-running transactions with heartbeat
 */
export async function withHeartbeatTransaction<T>(
  operation: (tx: typeof db, heartbeat: () => void) => Promise<T>,
  options: { heartbeatIntervalMs?: number } = {}
): Promise<T> {
  const { heartbeatIntervalMs = 5000 } = options;

  return await db.transaction(async (tx) => {
    let lastHeartbeat = Date.now();

    const heartbeat = () => {
      lastHeartbeat = Date.now();
    };

    // Monitor for stale transaction
    const monitor = setInterval(async () => {
      if (Date.now() - lastHeartbeat > heartbeatIntervalMs * 2) {
        console.warn('Transaction appears stale - no heartbeat received');
      }
    }, heartbeatIntervalMs);

    try {
      return await operation(tx, heartbeat);
    } finally {
      clearInterval(monitor);
    }
  });
}

/**
 * Safe nested transaction (savepoints)
 */
export async function withSavepoint<T>(
  tx: typeof db,
  name: string,
  operation: () => Promise<T>
): Promise<T> {
  await tx.execute(sql`SAVEPOINT ${sql.identifier(name)}`);

  try {
    const result = await operation();
    await tx.execute(sql`RELEASE SAVEPOINT ${sql.identifier(name)}`);
    return result;
  } catch (error) {
    await tx.execute(sql`ROLLBACK TO SAVEPOINT ${sql.identifier(name)}`);
    throw error;
  }
}
```

---

## 🗑️ SOFT DELETE PATTERNS

```typescript
// lib/db/soft-delete.ts
import { db } from '@/db';
import { eq, isNull, and, or, sql } from 'drizzle-orm';
import { PgTable, PgColumn } from 'drizzle-orm/pg-core';

/**
 * Soft delete helper for any table with deletedAt column
 */
export function softDeleteable<T extends PgTable>(table: T) {
  return {
    /**
     * Soft delete a record
     */
    async delete(
      id: string,
      deletedBy?: string
    ): Promise<void> {
      await db
        .update(table)
        .set({
          deletedAt: new Date(),
          deletedBy: deletedBy,
        } as any)
        .where(eq((table as any).id, id));
    },

    /**
     * Restore a soft-deleted record
     */
    async restore(id: string): Promise<void> {
      await db
        .update(table)
        .set({
          deletedAt: null,
          deletedBy: null,
        } as any)
        .where(eq((table as any).id, id));
    },

    /**
     * Query only non-deleted records
     */
    whereNotDeleted() {
      return isNull((table as any).deletedAt);
    },

    /**
     * Query only deleted records
     */
    whereDeleted() {
      return isNotNull((table as any).deletedAt);
    },

    /**
     * Permanently delete records older than retention period
     */
    async purgeExpired(retentionDays: number): Promise<number> {
      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

      const result = await db
        .delete(table)
        .where(
          and(
            isNotNull((table as any).deletedAt),
            sql`${(table as any).deletedAt} < ${cutoff}`
          )
        );

      return result.rowCount || 0;
    },
  };
}

/**
 * Cascade soft delete to related records
 */
export async function cascadeSoftDelete(
  parentTable: PgTable,
  parentId: string,
  childRelations: Array<{
    table: PgTable;
    foreignKey: string;
  }>,
  deletedBy?: string
): Promise<void> {
  await withTransaction(async (tx) => {
    // Soft delete children first
    for (const relation of childRelations) {
      await tx
        .update(relation.table)
        .set({
          deletedAt: new Date(),
          deletedBy,
        } as any)
        .where(eq((relation.table as any)[relation.foreignKey], parentId));
    }

    // Soft delete parent
    await tx
      .update(parentTable)
      .set({
        deletedAt: new Date(),
        deletedBy,
      } as any)
      .where(eq((parentTable as any).id, parentId));
  });
}
```

---

## 🔗 CONNECTION POOLING & LIMITS

```typescript
// lib/db/pool.ts
import { Pool } from 'pg';

export const POOL_CONFIG = {
  // For serverless (Vercel, etc.) - use lower limits
  serverless: {
    max: 10,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  },
  // For long-running server
  standard: {
    max: 50,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  },
};

/**
 * Query with connection timeout handling
 */
export async function queryWithTimeout<T>(
  query: () => Promise<T>,
  timeoutMs: number = 10000
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new QueryTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  return Promise.race([query(), timeoutPromise]);
}

class QueryTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Query timed out after ${timeoutMs}ms`);
    this.name = 'QueryTimeoutError';
  }
}

/**
 * Handle connection pool exhaustion
 */
export class PoolMonitor {
  private waitingCount = 0;
  private maxWaiting = 100;

  async acquireConnection<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    if (this.waitingCount >= this.maxWaiting) {
      throw new PoolExhaustedError();
    }

    this.waitingCount++;

    try {
      return await operation();
    } finally {
      this.waitingCount--;
    }
  }

  getStats(): { waiting: number; maxWaiting: number } {
    return {
      waiting: this.waitingCount,
      maxWaiting: this.maxWaiting,
    };
  }
}

class PoolExhaustedError extends Error {
  constructor() {
    super('Connection pool exhausted. Please try again later.');
    this.name = 'PoolExhaustedError';
  }
}
```

---

## 🔒 DEADLOCK PREVENTION

```typescript
// lib/db/deadlock.ts
import { db } from '@/db';
import { sql } from 'drizzle-orm';

/**
 * Acquire locks in consistent order to prevent deadlocks
 */
export async function withOrderedLocks<T>(
  resources: string[],
  operation: () => Promise<T>
): Promise<T> {
  // Sort resources to ensure consistent lock order
  const sortedResources = [...resources].sort();

  return await db.transaction(async (tx) => {
    // Acquire advisory locks in order
    for (const resource of sortedResources) {
      const lockId = hashToInt(resource);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockId})`);
    }

    return await operation();
  });
}

/**
 * Try to acquire lock with timeout (non-blocking)
 */
export async function tryLock(
  resource: string,
  timeoutMs: number = 5000
): Promise<{ acquired: boolean; release: () => Promise<void> }> {
  const lockId = hashToInt(resource);

  // Try to acquire lock with timeout
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const [result] = await db.execute<{ acquired: boolean }>(
      sql`SELECT pg_try_advisory_lock(${lockId}) as acquired`
    );

    if (result.acquired) {
      return {
        acquired: true,
        release: async () => {
          await db.execute(sql`SELECT pg_advisory_unlock(${lockId})`);
        },
      };
    }

    // Wait a bit before retrying
    await new Promise((r) => setTimeout(r, 100));
  }

  return {
    acquired: false,
    release: async () => {},
  };
}

/**
 * Detect potential deadlock and fail fast
 */
export async function withDeadlockDetection<T>(
  operation: () => Promise<T>,
  timeoutMs: number = 5000
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new DeadlockTimeoutError());
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation(), timeoutPromise]);
  } catch (error) {
    // Check for deadlock error (PostgreSQL error code 40P01)
    if (error instanceof Error && (error as any).code === '40P01') {
      throw new DeadlockDetectedError();
    }
    throw error;
  }
}

class DeadlockTimeoutError extends Error {
  constructor() {
    super('Operation timed out - possible deadlock');
    this.name = 'DeadlockTimeoutError';
  }
}

class DeadlockDetectedError extends Error {
  constructor() {
    super('Deadlock detected - transaction was rolled back');
    this.name = 'DeadlockDetectedError';
  }
}

function hashToInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
```

---

## 📊 MIGRATION EDGE CASES

```typescript
// scripts/migration-helpers.ts

/**
 * Safe column addition with default value
 * Avoids table lock on large tables
 */
export function safeAddColumn(
  tableName: string,
  columnName: string,
  columnType: string,
  defaultValue?: string
): string[] {
  const statements: string[] = [];

  // Add column without default (fast)
  statements.push(
    `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${columnName} ${columnType}`
  );

  if (defaultValue) {
    // Set default for new rows
    statements.push(
      `ALTER TABLE ${tableName} ALTER COLUMN ${columnName} SET DEFAULT ${defaultValue}`
    );

    // Backfill in batches to avoid long locks
    statements.push(`
      DO $$
      DECLARE
        batch_size INT := 1000;
        updated INT;
      BEGIN
        LOOP
          UPDATE ${tableName}
          SET ${columnName} = ${defaultValue}
          WHERE id IN (
            SELECT id FROM ${tableName}
            WHERE ${columnName} IS NULL
            LIMIT batch_size
          );
          GET DIAGNOSTICS updated = ROW_COUNT;
          EXIT WHEN updated = 0;
          COMMIT;
        END LOOP;
      END $$;
    `);
  }

  return statements;
}

/**
 * Safe index creation (concurrent, non-blocking)
 */
export function safeCreateIndex(
  indexName: string,
  tableName: string,
  columns: string[],
  options: { unique?: boolean; where?: string } = {}
): string {
  const unique = options.unique ? 'UNIQUE' : '';
  const where = options.where ? `WHERE ${options.where}` : '';

  return `CREATE ${unique} INDEX CONCURRENTLY IF NOT EXISTS ${indexName} ON ${tableName} (${columns.join(', ')}) ${where}`;
}

/**
 * Safe column rename (two-phase)
 */
export function safeRenameColumn(
  tableName: string,
  oldName: string,
  newName: string
): {
  phase1: string[];
  phase2: string[];
} {
  return {
    // Phase 1: Add new column, copy data
    phase1: [
      `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${newName} TEXT`, // Same type as old
      `UPDATE ${tableName} SET ${newName} = ${oldName} WHERE ${newName} IS NULL`,
      // Add trigger to keep in sync during transition
      `CREATE OR REPLACE FUNCTION sync_${tableName}_${oldName}_${newName}()
       RETURNS TRIGGER AS $$
       BEGIN
         IF TG_OP = 'UPDATE' THEN
           NEW.${newName} := NEW.${oldName};
         END IF;
         RETURN NEW;
       END;
       $$ LANGUAGE plpgsql;`,
      `DROP TRIGGER IF EXISTS sync_${oldName}_trigger ON ${tableName}`,
      `CREATE TRIGGER sync_${oldName}_trigger
       BEFORE UPDATE ON ${tableName}
       FOR EACH ROW EXECUTE FUNCTION sync_${tableName}_${oldName}_${newName}()`,
    ],
    // Phase 2: Remove old column (after all code updated)
    phase2: [
      `DROP TRIGGER IF EXISTS sync_${oldName}_trigger ON ${tableName}`,
      `DROP FUNCTION IF EXISTS sync_${tableName}_${oldName}_${newName}()`,
      `ALTER TABLE ${tableName} DROP COLUMN IF EXISTS ${oldName}`,
    ],
  };
}

/**
 * Rollback plan generator
 */
export function generateRollback(
  migration: string[]
): string[] {
  const rollback: string[] = [];

  for (const statement of migration) {
    // Generate inverse operations
    if (statement.includes('ADD COLUMN')) {
      const match = statement.match(/ADD COLUMN (\w+)/);
      if (match) {
        rollback.unshift(`ALTER TABLE ... DROP COLUMN IF EXISTS ${match[1]}`);
      }
    }

    if (statement.includes('CREATE INDEX')) {
      const match = statement.match(/INDEX (\w+)/);
      if (match) {
        rollback.unshift(`DROP INDEX IF EXISTS ${match[1]}`);
      }
    }

    // Add more reverse operations as needed
  }

  return rollback;
}
```

---

## 📋 DATABASE EDGE CASES CHECKLIST

```markdown
## Edge Cases Covered

### Transactions
- [ ] Serialization failure retry
- [ ] Transaction timeout
- [ ] Heartbeat for long transactions
- [ ] Savepoints for nested operations

### Soft Delete
- [ ] Cascade soft delete
- [ ] Restore functionality
- [ ] Purge expired records
- [ ] Query filters

### Connection Pool
- [ ] Pool exhaustion handling
- [ ] Query timeout
- [ ] Connection monitoring

### Deadlocks
- [ ] Ordered lock acquisition
- [ ] Non-blocking lock attempts
- [ ] Deadlock detection
- [ ] Timeout handling

### Migrations
- [ ] Non-blocking column addition
- [ ] Concurrent index creation
- [ ] Two-phase column rename
- [ ] Rollback plans
```

---
