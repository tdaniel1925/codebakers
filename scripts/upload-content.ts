/**
 * Script to upload local .claude/ folder as a new content version
 *
 * Usage:
 * 1. Start dev server: npm run dev
 * 2. Login to admin at http://localhost:3000/admin
 * 3. Run: npx tsx scripts/upload-content.ts --cookie "your-session-cookie"
 *
 * Or use with production:
 * npx tsx scripts/upload-content.ts --url https://codebakers.dev --cookie "your-session-cookie"
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const args = process.argv.slice(2);
const urlArg = args.find(a => a.startsWith('--url='))?.split('=')[1] || 'http://localhost:3000';
const cookieArg = args.find(a => a.startsWith('--cookie='))?.split('=')[1];

async function uploadContent() {
  const cwd = process.cwd();
  const claudeDir = join(cwd, '.claude');
  const claudeMdPath = join(cwd, 'CLAUDE.md');

  console.log('📦 Uploading content from filesystem...\n');
  console.log(`   Target: ${urlArg}`);

  // Read CLAUDE.md
  let claudeMdContent = '';
  if (existsSync(claudeMdPath)) {
    claudeMdContent = readFileSync(claudeMdPath, 'utf-8');
    console.log(`✓ Read CLAUDE.md (${claudeMdContent.split('\n').length} lines)`);
  }

  // Read all modules from .claude/
  const modulesContent: Record<string, string> = {};
  if (existsSync(claudeDir)) {
    const files = readdirSync(claudeDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const content = readFileSync(join(claudeDir, file), 'utf-8');
      modulesContent[file] = content;
    }
    console.log(`✓ Read ${files.length} modules from .claude/`);
  }

  // Get current versions to determine next version number
  console.log('\n📊 Fetching current versions...');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (cookieArg) {
    headers['Cookie'] = cookieArg;
  }

  const listRes = await fetch(`${urlArg}/api/admin/content`, { headers });

  if (!listRes.ok) {
    const text = await listRes.text();
    throw new Error(`Failed to list versions (${listRes.status}): ${text}`);
  }

  const { versions } = await listRes.json();
  const activeVersion = versions?.find((v: { isActive: boolean }) => v.isActive);

  let newVersionNumber = '16.0';
  if (activeVersion) {
    const parts = activeVersion.version.split('.');
    const major = parseInt(parts[0]) || 15;
    const minor = parseInt(parts[1]) || 0;
    newVersionNumber = `${major}.${minor + 1}`;
    console.log(`   Current active: ${activeVersion.version}`);
  }

  console.log(`\n📝 Creating version ${newVersionNumber}...`);

  // Create new version
  const createRes = await fetch(`${urlArg}/api/admin/content`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      version: newVersionNumber,
      claudeMdContent,
      routerContent: claudeMdContent,
      modulesContent,
      changelog: `Updated to ${Object.keys(modulesContent).length} modules`,
    }),
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Failed to create version (${createRes.status}): ${text}`);
  }

  const { version: newVersion } = await createRes.json();
  console.log(`✓ Created version ${newVersion.id}`);

  // Publish the version
  console.log(`📤 Publishing version...`);

  const publishRes = await fetch(`${urlArg}/api/admin/content/${newVersion.id}/publish`, {
    method: 'POST',
    headers,
  });

  if (!publishRes.ok) {
    const text = await publishRes.text();
    throw new Error(`Failed to publish (${publishRes.status}): ${text}`);
  }

  console.log(`\n✅ Version ${newVersionNumber} published!`);
  console.log(`   - ${Object.keys(modulesContent).length} modules`);
  console.log(`   - ${claudeMdContent.split('\n').length} lines in CLAUDE.md`);
  console.log(`\n🎉 Users will now get ${Object.keys(modulesContent).length} modules on upgrade!`);

  process.exit(0);
}

uploadContent().catch((err) => {
  console.error('❌ Error:', err.message);
  console.log('\nTips:');
  console.log('1. Make sure you\'re logged in as admin');
  console.log('2. Get your session cookie from browser DevTools');
  console.log('3. Run: npx tsx scripts/upload-content.ts --cookie="your-cookie-here"');
  process.exit(1);
});
