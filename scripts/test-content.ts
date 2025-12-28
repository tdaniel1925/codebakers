import { config } from 'dotenv';
config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/db/schema.js';
import { contentVersions } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { obfuscateContent } from '../src/services/obfuscation-service.js';

const connectionString = process.env.DATABASE_URL + '?sslmode=require';
const sql = postgres(connectionString);
const db = drizzle(sql, { schema });

async function test() {
  console.log('Testing content service...\n');

  // Get active version
  const [version] = await db
    .select()
    .from(contentVersions)
    .where(eq(contentVersions.isActive, true))
    .limit(1);

  if (!version) {
    console.log('No active version found!');
    process.exit(1);
  }

  console.log('Version:', version.version);
  console.log('CLAUDE.md length:', version.claudeMdContent?.length || 0);

  // Parse modules
  const modules = version.modulesContent ? JSON.parse(version.modulesContent) : {};
  console.log('Modules:', Object.keys(modules).length);

  // Test obfuscation
  const testModule = Object.values(modules)[0] as string;
  if (testModule) {
    console.log('\nFirst module length:', testModule.length);
    const obfuscated = obfuscateContent(testModule);
    console.log('Obfuscated length:', obfuscated.length);
  }

  console.log('\n✅ Test passed!');
  process.exit(0);
}

test().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
