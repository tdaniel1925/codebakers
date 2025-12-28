import 'dotenv/config';
import { db } from '../src/db/index.js';
import { contentVersions } from '../src/db/schema.js';

async function main() {
  console.log('Checking content versions...\n');

  const versions = await db.select().from(contentVersions);

  console.log(`Found ${versions.length} versions:\n`);

  for (const v of versions) {
    const moduleCount = v.modulesContent
      ? Object.keys(JSON.parse(v.modulesContent)).length
      : 0;
    const cursorModuleCount = v.cursorModulesContent
      ? Object.keys(JSON.parse(v.cursorModulesContent)).length
      : 0;

    console.log(`Version: ${v.version} ${v.isActive ? '✅ ACTIVE' : ''}`);
    console.log(`  Router content: ${v.routerContent ? v.routerContent.length + ' chars' : 'NONE'}`);
    console.log(`  CLAUDE.md content: ${v.claudeMdContent ? v.claudeMdContent.length + ' chars' : 'NONE'}`);
    console.log(`  .claude/ modules: ${moduleCount}`);
    console.log(`  .cursorrules-modules/: ${cursorModuleCount}`);
    console.log(`  Created: ${v.createdAt}`);
    console.log('---');
  }

  process.exit(0);
}

main().catch(console.error);
