import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/auth';
import { ContentManagementService } from '@/services/content-management-service';
import { autoRateLimit } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

/**
 * Validate that new modules use sequential numbering
 */
function validateModuleNumbering(
  existingModules: string[],
  newModules: Record<string, string>
): { valid: boolean; error?: string; nextNumber: number } {
  // Get existing module numbers
  const existingNumbers = existingModules
    .map(name => {
      const match = name.match(/^(\d+)-/);
      return match ? parseInt(match[1], 10) : null;
    })
    .filter((n): n is number => n !== null);

  const maxExisting = existingNumbers.length > 0 ? Math.max(...existingNumbers) : -1;
  const nextNumber = maxExisting + 1;

  // Check new modules for proper numbering
  const newModuleNames = Object.keys(newModules);
  const newNumbers: number[] = [];

  for (const name of newModuleNames) {
    const match = name.match(/^(\d+)-/);
    if (!match) {
      return { valid: false, error: `Module "${name}" doesn't follow XX-name.md format`, nextNumber };
    }

    const num = parseInt(match[1], 10);
    newNumbers.push(num);

    // Check if this is an update to an existing module (allowed)
    if (existingNumbers.includes(num)) {
      continue; // Updating existing module is fine
    }

    // For new modules, must use sequential numbering
    if (num < nextNumber) {
      return {
        valid: false,
        error: `Module "${name}" uses number ${num}, but that's already used. Next available: ${nextNumber}`,
        nextNumber
      };
    }
  }

  // Check for gaps in new modules
  const onlyNewNumbers = newNumbers.filter(n => !existingNumbers.includes(n)).sort((a, b) => a - b);
  for (let i = 0; i < onlyNewNumbers.length; i++) {
    const expected = nextNumber + i;
    if (onlyNewNumbers[i] !== expected) {
      return {
        valid: false,
        error: `Module numbering gap: expected ${expected}, got ${onlyNewNumbers[i]}. Use sequential numbers.`,
        nextNumber
      };
    }
  }

  return { valid: true, nextNumber };
}

export async function POST(request: NextRequest) {
  try {
    autoRateLimit(request);
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

    // Validate module numbering before merging
    if (changes.modules) {
      const existingModuleNames = Object.keys(activeVersion?.modulesContent || {});
      const validation = validateModuleNumbering(existingModuleNames, changes.modules);

      if (!validation.valid) {
        return NextResponse.json(
          {
            success: false,
            data: {
              error: validation.error,
              nextAvailableNumber: validation.nextNumber,
              hint: `Use ${validation.nextNumber.toString().padStart(2, '0')}-modulename.md format`,
            },
          },
          { status: 400 }
        );
      }

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
