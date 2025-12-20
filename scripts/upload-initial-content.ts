/**
 * Upload initial content to the database
 * Run with: npx tsx scripts/upload-initial-content.ts
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { db } from '../src/db';
import { contentVersions } from '../src/db/schema';

const CONTENT_DIR = 'c:/dev/1 - CodeBakers';

async function uploadContent() {
  console.log('📦 Uploading initial content...\n');

  // Read CLAUDE.md
  const claudeMdPath = join(CONTENT_DIR, 'CLAUDE.md');
  let claudeMdContent = '';
  if (existsSync(claudeMdPath)) {
    claudeMdContent = readFileSync(claudeMdPath, 'utf-8');
    console.log('✓ CLAUDE.md loaded');
  } else {
    console.log('✗ CLAUDE.md not found');
  }

  // Read .claude/ modules
  const modulesDir = join(CONTENT_DIR, '.claude');
  const modulesContent: Record<string, string> = {};

  if (existsSync(modulesDir)) {
    const files = readdirSync(modulesDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const content = readFileSync(join(modulesDir, file), 'utf-8');
      modulesContent[file] = content;
    }
    console.log(`✓ Loaded ${files.length} modules from .claude/`);
  } else {
    console.log('✗ .claude/ folder not found');
  }

  // Create version in database
  // Note: modulesContent is stored as JSON string in database
  const version = await db.insert(contentVersions).values({
    version: '1.0',
    claudeMdContent,
    modulesContent: JSON.stringify(modulesContent),
    changelog: 'Initial content upload',
    isActive: true,
    publishedAt: new Date(),
  }).returning();

  console.log(`\n✅ Content uploaded! Version: ${version[0].version}`);
  console.log(`   ID: ${version[0].id}`);
  console.log(`   Modules: ${Object.keys(modulesContent).length}`);
  console.log(`   Status: Published (active)\n`);

  process.exit(0);
}

uploadContent().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
