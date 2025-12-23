import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables from .env.local
config({ path: join(__dirname, '..', '.env.local') });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { readFileSync } from 'fs';
import { contentVersions } from '../src/db/schema';

// Create connection with SSL for Supabase
const connectionString = process.env.DATABASE_URL!;
const queryClient = postgres(connectionString, { ssl: 'require' });
const db = drizzle(queryClient);

async function updateClaudeMd() {
  console.log('Reading CLAUDE.md...');
  const claudeMdPath = join(__dirname, '..', 'CLAUDE.md');
  const claudeMdContent = readFileSync(claudeMdPath, 'utf-8');
  console.log(`Read ${claudeMdContent.length} characters`);

  console.log('Finding active version...');
  const [activeVersion] = await db
    .select()
    .from(contentVersions)
    .where(eq(contentVersions.isActive, true))
    .limit(1);

  if (!activeVersion) {
    console.error('No active version found!');
    await queryClient.end();
    process.exit(1);
  }

  console.log(`Found active version: ${activeVersion.version} (ID: ${activeVersion.id})`);

  console.log('Updating claudeMdContent...');
  await db
    .update(contentVersions)
    .set({ claudeMdContent })
    .where(eq(contentVersions.id, activeVersion.id));

  console.log('Done! CLAUDE.md has been updated in the active content version.');
  await queryClient.end();
  process.exit(0);
}

updateClaudeMd().catch(async (err) => {
  console.error('Error:', err);
  await queryClient.end();
  process.exit(1);
});
