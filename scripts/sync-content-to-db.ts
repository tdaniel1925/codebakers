/**
 * Sync local .claude/ folder content to database
 *
 * This script reads all pattern files from the local .claude/ folder
 * and creates a new content version in the database.
 *
 * Usage: npx tsx scripts/sync-content-to-db.ts
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { db, contentVersions } from '../src/db';
import { eq, desc } from 'drizzle-orm';

const CLAUDE_DIR = join(process.cwd(), '.claude');
const CURSORRULES_DIR = join(process.cwd(), '.cursorrules-modules');

async function syncContentToDatabase() {
  console.log('🔄 Syncing local content to database...\n');

  // Read CLAUDE.md (router)
  const claudeMdPath = join(process.cwd(), 'CLAUDE.md');
  let claudeMdContent = '';
  if (existsSync(claudeMdPath)) {
    claudeMdContent = readFileSync(claudeMdPath, 'utf-8');
    console.log(`✅ Found CLAUDE.md (${claudeMdContent.split('\n').length} lines)`);
  } else {
    console.log('⚠️ CLAUDE.md not found');
  }

  // Read .cursorrules
  const cursorRulesPath = join(process.cwd(), '.cursorrules');
  let cursorRulesContent = '';
  if (existsSync(cursorRulesPath)) {
    cursorRulesContent = readFileSync(cursorRulesPath, 'utf-8');
    console.log(`✅ Found .cursorrules (${cursorRulesContent.split('\n').length} lines)`);
  } else {
    console.log('⚠️ .cursorrules not found');
  }

  // Read .claude/ modules
  const modulesContent: Record<string, string> = {};
  if (existsSync(CLAUDE_DIR)) {
    const files = readdirSync(CLAUDE_DIR).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const content = readFileSync(join(CLAUDE_DIR, file), 'utf-8');
      modulesContent[file] = content;
    }
    console.log(`✅ Found ${files.length} modules in .claude/`);
    console.log(`   Files: ${files.join(', ')}`);
  } else {
    console.log('⚠️ .claude/ folder not found');
  }

  // Read .cursorrules-modules/
  const cursorModulesContent: Record<string, string> = {};
  if (existsSync(CURSORRULES_DIR)) {
    const files = readdirSync(CURSORRULES_DIR).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const content = readFileSync(join(CURSORRULES_DIR, file), 'utf-8');
      cursorModulesContent[file] = content;
    }
    console.log(`✅ Found ${files.length} cursor modules in .cursorrules-modules/`);
  }

  // Get current active version
  const [activeVersion] = await db
    .select()
    .from(contentVersions)
    .where(eq(contentVersions.isActive, true))
    .limit(1);

  // Calculate new version number
  const [latestVersion] = await db
    .select({ version: contentVersions.version })
    .from(contentVersions)
    .orderBy(desc(contentVersions.createdAt))
    .limit(1);

  let newVersionNumber = '16.0';
  if (latestVersion?.version) {
    const parts = latestVersion.version.split('.');
    const major = parseInt(parts[0]) || 15;
    const minor = parseInt(parts[1]) || 0;
    newVersionNumber = `${major}.${minor + 1}`;
  }

  console.log(`\n📦 Creating version ${newVersionNumber}...`);

  // Create new version
  const [newVersion] = await db
    .insert(contentVersions)
    .values({
      version: newVersionNumber,
      routerContent: claudeMdContent,
      claudeMdContent: claudeMdContent,
      cursorRulesContent: cursorRulesContent,
      modulesContent: JSON.stringify(modulesContent),
      cursorModulesContent: JSON.stringify(cursorModulesContent),
      changelog: `Synced from local .claude/ folder - ${Object.keys(modulesContent).length} modules`,
      isActive: false,
    })
    .returning();

  console.log(`✅ Created version ${newVersion.version} (id: ${newVersion.id})`);

  // Ask to activate
  console.log(`\n📊 Content Summary:`);
  console.log(`   - CLAUDE.md: ${claudeMdContent ? 'Yes' : 'No'}`);
  console.log(`   - .cursorrules: ${cursorRulesContent ? 'Yes' : 'No'}`);
  console.log(`   - Modules: ${Object.keys(modulesContent).length}`);
  console.log(`   - Cursor Modules: ${Object.keys(cursorModulesContent).length}`);

  // List all modules
  console.log(`\n📂 Modules included:`);
  Object.keys(modulesContent).sort().forEach(file => {
    const lines = modulesContent[file].split('\n').length;
    console.log(`   - ${file} (${lines} lines)`);
  });

  // Activate the new version
  console.log(`\n🚀 Activating version ${newVersionNumber}...`);

  // Deactivate all versions
  await db
    .update(contentVersions)
    .set({ isActive: false });

  // Activate the new version
  await db
    .update(contentVersions)
    .set({
      isActive: true,
      publishedAt: new Date(),
    })
    .where(eq(contentVersions.id, newVersion.id));

  console.log(`\n✅ Version ${newVersionNumber} is now ACTIVE!`);
  console.log(`\n🎉 Done! Users will now receive the updated content.`);

  process.exit(0);
}

syncContentToDatabase().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
