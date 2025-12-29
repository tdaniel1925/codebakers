import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { db } from '@/db';
import { contentVersions } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/sync-content
 *
 * Syncs local .claude/ folder content to database.
 * Creates a new content version and optionally activates it.
 *
 * Requires admin authentication.
 */
export async function POST(req: NextRequest) {
  try {
    // Check admin auth
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin (you may want to add proper admin check)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const activate = body.activate !== false; // Default to true

    const CLAUDE_DIR = join(process.cwd(), '.claude');
    const CURSORRULES_DIR = join(process.cwd(), '.cursorrules-modules');

    const result: Record<string, unknown> = {
      claudeMd: false,
      cursorRules: false,
      modules: [] as string[],
      cursorModules: [] as string[],
    };

    // Read CLAUDE.md (router)
    const claudeMdPath = join(process.cwd(), 'CLAUDE.md');
    let claudeMdContent = '';
    if (existsSync(claudeMdPath)) {
      claudeMdContent = readFileSync(claudeMdPath, 'utf-8');
      result.claudeMd = true;
    }

    // Read .cursorrules
    const cursorRulesPath = join(process.cwd(), '.cursorrules');
    let cursorRulesContent = '';
    if (existsSync(cursorRulesPath)) {
      cursorRulesContent = readFileSync(cursorRulesPath, 'utf-8');
      result.cursorRules = true;
    }

    // Read .claude/ modules
    const modulesContent: Record<string, string> = {};
    if (existsSync(CLAUDE_DIR)) {
      const files = readdirSync(CLAUDE_DIR).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const content = readFileSync(join(CLAUDE_DIR, file), 'utf-8');
        modulesContent[file] = content;
      }
      result.modules = files;
    }

    // Read .cursorrules-modules/
    const cursorModulesContent: Record<string, string> = {};
    if (existsSync(CURSORRULES_DIR)) {
      const files = readdirSync(CURSORRULES_DIR).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const content = readFileSync(join(CURSORRULES_DIR, file), 'utf-8');
        cursorModulesContent[file] = content;
      }
      result.cursorModules = files;
    }

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
        changelog: `Synced from server - ${Object.keys(modulesContent).length} modules`,
        publishedBy: user.id,
        isActive: false,
      })
      .returning();

    result.versionId = newVersion.id;
    result.version = newVersion.version;

    // Activate if requested
    if (activate) {
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

      result.activated = true;
    }

    return NextResponse.json({
      success: true,
      message: `Created version ${newVersionNumber} with ${Object.keys(modulesContent).length} modules`,
      ...result,
    });
  } catch (error) {
    console.error('Sync content error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync content' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/sync-content
 *
 * Returns info about what would be synced (dry run)
 */
export async function GET(req: NextRequest) {
  try {
    // Check admin auth
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const CLAUDE_DIR = join(process.cwd(), '.claude');
    const CURSORRULES_DIR = join(process.cwd(), '.cursorrules-modules');

    const result: Record<string, unknown> = {};

    // Check CLAUDE.md
    const claudeMdPath = join(process.cwd(), 'CLAUDE.md');
    result.claudeMd = existsSync(claudeMdPath);
    if (result.claudeMd) {
      const content = readFileSync(claudeMdPath, 'utf-8');
      result.claudeMdLines = content.split('\n').length;
    }

    // Check .cursorrules
    const cursorRulesPath = join(process.cwd(), '.cursorrules');
    result.cursorRules = existsSync(cursorRulesPath);
    if (result.cursorRules) {
      const content = readFileSync(cursorRulesPath, 'utf-8');
      result.cursorRulesLines = content.split('\n').length;
    }

    // Check .claude/ modules
    result.modules = [];
    if (existsSync(CLAUDE_DIR)) {
      const files = readdirSync(CLAUDE_DIR).filter(f => f.endsWith('.md'));
      result.modules = files.map(f => {
        const content = readFileSync(join(CLAUDE_DIR, f), 'utf-8');
        return { name: f, lines: content.split('\n').length };
      });
    }

    // Check .cursorrules-modules/
    result.cursorModules = [];
    if (existsSync(CURSORRULES_DIR)) {
      const files = readdirSync(CURSORRULES_DIR).filter(f => f.endsWith('.md'));
      result.cursorModules = files.map(f => {
        const content = readFileSync(join(CURSORRULES_DIR, f), 'utf-8');
        return { name: f, lines: content.split('\n').length };
      });
    }

    // Get current active version
    const [activeVersion] = await db
      .select({
        version: contentVersions.version,
        modulesContent: contentVersions.modulesContent,
      })
      .from(contentVersions)
      .where(eq(contentVersions.isActive, true))
      .limit(1);

    if (activeVersion) {
      result.currentVersion = activeVersion.version;
      const modules = activeVersion.modulesContent
        ? JSON.parse(activeVersion.modulesContent)
        : {};
      result.currentModuleCount = Object.keys(modules).length;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Sync content check error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check content' },
      { status: 500 }
    );
  }
}
