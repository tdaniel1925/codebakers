import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables from .env.local
config({ path: join(__dirname, '..', '.env.local') });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { contentVersions } from '../src/db/schema';

// Create connection with SSL for Supabase
const connectionString = process.env.DATABASE_URL!;
const queryClient = postgres(connectionString, { ssl: 'require' });
const db = drizzle(queryClient);

const CONTENT_DIR = 'c:/dev/1 - CodeBakers';

async function updateClaudeMd() {
  // Read CLAUDE.md
  console.log('Reading CLAUDE.md...');
  const claudeMdPath = join(CONTENT_DIR, 'CLAUDE.md');
  const claudeMdContent = readFileSync(claudeMdPath, 'utf-8');
  console.log(`Read ${claudeMdContent.length} characters`);

  // Read .claude/ modules
  console.log('Reading .claude/ modules...');
  const modulesDir = join(CONTENT_DIR, '.claude');
  const modulesContent: Record<string, string> = {};

  if (existsSync(modulesDir)) {
    const files = readdirSync(modulesDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const content = readFileSync(join(modulesDir, file), 'utf-8');
      modulesContent[file] = content;
    }
    console.log(`Loaded ${files.length} modules from .claude/`);
  } else {
    console.log('.claude/ folder not found, skipping modules');
  }

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

  console.log('Updating claudeMdContent and modulesContent...');
  await db
    .update(contentVersions)
    .set({
      claudeMdContent,
      modulesContent: JSON.stringify(modulesContent),
    })
    .where(eq(contentVersions.id, activeVersion.id));

  console.log('Done! CLAUDE.md and modules have been updated.');
  await queryClient.end();
  process.exit(0);
}

updateClaudeMd().catch(async (err) => {
  console.error('Error:', err);
  await queryClient.end();
  process.exit(1);
});
