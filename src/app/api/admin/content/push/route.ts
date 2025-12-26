import { NextRequest } from 'next/server';
import { ContentManagementService } from '@/services/content-management-service';
import { handleApiError, successResponse, autoRateLimit } from '@/lib/api-utils';
import { db } from '@/db';
import { users, apiKeys, teamMembers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * Hash API key for lookup
 */
function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Verify API key and check admin status
 * Supports both Bearer token and x-admin-api-key header
 */
async function verifyAdminAuth(req: NextRequest): Promise<{ id: string } | null> {
  // Try Bearer token first
  let apiKey = req.headers.get('authorization')?.replace('Bearer ', '');

  // Fall back to x-admin-api-key header
  if (!apiKey) {
    apiKey = req.headers.get('x-admin-api-key');
  }

  if (!apiKey) return null;

  const keyHash = hashApiKey(apiKey);

  // Find the API key
  const [foundKey] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);

  if (!foundKey || !foundKey.isActive) {
    return null;
  }

  // Update last used
  await db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, foundKey.id));

  // Get the team and find the owner
  if (!foundKey.teamId) {
    return null;
  }

  // Find team owner/admin member
  const [member] = await db
    .select({ userId: teamMembers.userId })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, foundKey.teamId))
    .limit(1);

  if (!member) {
    return null;
  }

  // Check if user is admin
  const [user] = await db
    .select({ id: users.id, isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, member.userId))
    .limit(1);

  if (!user || !user.isAdmin) {
    return null;
  }

  return { id: user.id };
}

// POST - Push patterns from CLI
export async function POST(req: NextRequest) {
  try {
    autoRateLimit(req);

    const admin = await verifyAdminAuth(req);
    if (!admin) {
      return successResponse({ error: 'Admin authentication required. Use Bearer token or x-admin-api-key header.' }, 401);
    }

    const body = await req.json();
    const {
      version,
      claudeMdContent,
      cursorRulesContent,
      modulesContent,
      cursorModulesContent,
      changelog,
      autoPublish = false
    } = body;

    if (!version) {
      return successResponse({ error: 'Version is required' }, 400);
    }

    if (!claudeMdContent && !cursorRulesContent) {
      return successResponse({ error: 'At least one of claudeMdContent or cursorRulesContent is required' }, 400);
    }

    // Create the version
    const newVersion = await ContentManagementService.createVersion(admin.id, {
      version,
      routerContent: null,
      cursorRulesContent,
      claudeMdContent,
      modulesContent: modulesContent || {},
      cursorModulesContent: cursorModulesContent || {},
      changelog,
    });

    // Auto-publish if requested
    if (autoPublish && newVersion) {
      await ContentManagementService.publishVersion(newVersion.id);
    }

    return successResponse({
      success: true,
      version: newVersion,
      published: autoPublish,
      message: `Version ${version} created${autoPublish ? ' and published' : ''} successfully`
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// GET - Verify admin API key
export async function GET(req: NextRequest) {
  try {
    autoRateLimit(req);

    const admin = await verifyAdminAuth(req);
    if (!admin) {
      return successResponse({ error: 'Admin authentication required' }, 401);
    }

    return successResponse({
      valid: true,
      adminId: admin.id,
      message: 'API key is valid and has admin access'
    });
  } catch (error) {
    return handleApiError(error);
  }
}
