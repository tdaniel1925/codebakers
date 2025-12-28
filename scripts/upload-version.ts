import { config } from 'dotenv';
config({ path: '.env.local' });
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/db/schema.js';
import { contentVersions } from '../src/db/schema.js';

import { eq } from 'drizzle-orm';

// Use SSL for Supabase connection
const connectionString = process.env.DATABASE_URL + '?sslmode=require';
const sql = postgres(connectionString);
const db = drizzle(sql, { schema });

const CONTENT_DIR = 'c:/dev/1 - CodeBakers';

async function uploadVersion() {
  const version = '5.1';

  console.log(`\nUploading version ${version}...\n`);

  // 1. Read CLAUDE.md
  console.log('Reading CLAUDE.md...');
  const claudeMdPath = join(CONTENT_DIR, 'CLAUDE.md');
  const claudeMdContent = readFileSync(claudeMdPath, 'utf-8');
  console.log(`  ✓ CLAUDE.md: ${claudeMdContent.split('\n').length} lines`);

  // 2. Read .cursorrules (if exists)
  let cursorRulesContent = '';
  try {
    const cursorRulesPath = join(CONTENT_DIR, '.cursorrules');
    cursorRulesContent = readFileSync(cursorRulesPath, 'utf-8');
    console.log(`  ✓ .cursorrules: ${cursorRulesContent.split('\n').length} lines`);
  } catch {
    console.log('  - .cursorrules: not found (skipping)');
  }

  // 3. Read all .claude/ modules
  console.log('\nReading .claude/ modules...');
  const modulesDir = join(CONTENT_DIR, '.claude');
  const moduleFiles = readdirSync(modulesDir).filter(f => f.endsWith('.md'));

  const modulesContent: Record<string, string> = {};
  let totalLines = 0;

  for (const file of moduleFiles) {
    const content = readFileSync(join(modulesDir, file), 'utf-8');
    modulesContent[file] = content;
    totalLines += content.split('\n').length;
  }
  console.log(`  ✓ ${moduleFiles.length} modules loaded (${totalLines.toLocaleString()} total lines)`);

  // 4. Read .cursorrules-modules/ (if exists)
  let cursorModulesContent: Record<string, string> = {};
  try {
    const cursorModulesDir = join(CONTENT_DIR, '.cursorrules-modules');
    const cursorModuleFiles = readdirSync(cursorModulesDir).filter(f => f.endsWith('.md'));

    for (const file of cursorModuleFiles) {
      const content = readFileSync(join(cursorModulesDir, file), 'utf-8');
      cursorModulesContent[file] = content;
    }
    console.log(`  ✓ ${cursorModuleFiles.length} cursor modules loaded`);
  } catch {
    console.log('  - .cursorrules-modules/: not found (skipping)');
  }

  // 5. Deactivate all existing versions
  console.log('\nDeactivating existing versions...');
  await db.update(contentVersions).set({ isActive: false });
  console.log('  ✓ All versions deactivated');

  // 6. Create new version
  console.log(`\nCreating version ${version}...`);
  const [newVersion] = await db
    .insert(contentVersions)
    .values({
      version,
      claudeMdContent,
      cursorRulesContent: cursorRulesContent || null,
      routerContent: null, // deprecated
      modulesContent: JSON.stringify(modulesContent),
      cursorModulesContent: Object.keys(cursorModulesContent).length > 0
        ? JSON.stringify(cursorModulesContent)
        : null,
      changelog: `v${version} - Full upload with ${moduleFiles.length} modules. Fixed missing .claude/ folder from v5.0.`,
      isActive: true,
      publishedAt: new Date(),
    })
    .returning();

  console.log(`  ✓ Version ${version} created and activated!`);
  console.log(`  ID: ${newVersion.id}`);

  // 7. Verify
  console.log('\nVerifying...');
  const [active] = await db
    .select()
    .from(contentVersions)
    .where(eq(contentVersions.isActive, true));

  if (active) {
    const modules = active.modulesContent ? JSON.parse(active.modulesContent) : {};
    console.log(`  ✓ Active version: ${active.version}`);
    console.log(`  ✓ CLAUDE.md: ${active.claudeMdContent ? active.claudeMdContent.split('\n').length : 0} lines`);
    console.log(`  ✓ Modules: ${Object.keys(modules).length} files`);
  }

  console.log('\n✅ Upload complete!\n');
  process.exit(0);
}

uploadVersion().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
