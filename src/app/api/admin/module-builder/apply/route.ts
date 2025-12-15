import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/auth';
import { ContentManagementService } from '@/services/content-management-service';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, data: { error: 'Unauthorized' } }, { status: 401 });
    }

    const admin = await isAdmin(user.id);
    if (!admin) {
      return NextResponse.json({ success: false, data: { error: 'Admin access required' } }, { status: 403 });
    }

    const { changes } = await request.json();

    if (!changes) {
      return NextResponse.json(
        { success: false, data: { error: 'No changes provided' } },
        { status: 400 }
      );
    }

    // Get current active version to merge changes
    const activeVersion = await ContentManagementService.getActiveVersion();

    // Prepare new version data
    const newClaudeMd = changes.claudeMd || activeVersion?.claudeMdContent || null;
    const newCursorRules = changes.cursorRules || activeVersion?.cursorRulesContent || null;

    // Merge modules - keep existing and add/update new ones
    let newModules: Record<string, string> = {};
    if (activeVersion?.modulesContent) {
      newModules = { ...activeVersion.modulesContent };
    }
    if (changes.modules) {
      newModules = { ...newModules, ...changes.modules };
    }

    // Generate new version number
    let newVersionNumber = '1.0';
    if (activeVersion?.version) {
      const parts = activeVersion.version.split('.');
      const minor = parseInt(parts[1] || '0', 10) + 1;
      newVersionNumber = `${parts[0]}.${minor}`;
    }

    // Create new version
    const newVersion = await ContentManagementService.createVersion(user.id, {
      version: newVersionNumber,
      claudeMdContent: newClaudeMd,
      cursorRulesContent: newCursorRules,
      modulesContent: Object.keys(newModules).length > 0 ? newModules : undefined,
      changelog: `AI-generated update: ${changes.summary}`,
    });

    // Auto-publish the new version
    await ContentManagementService.publishVersion(newVersion.id);

    return NextResponse.json({
      success: true,
      data: {
        version: newVersion,
        message: 'Changes applied and published successfully',
      },
    });
  } catch (error) {
    console.error('Apply changes error:', error);
    return NextResponse.json(
      { success: false, data: { error: 'Failed to apply changes' } },
      { status: 500 }
    );
  }
}
