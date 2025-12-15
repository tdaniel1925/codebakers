import { NextRequest } from 'next/server';
import { requireAdmin, getServerSession } from '@/lib/auth';
import { ContentManagementService } from '@/services/content-management-service';
import { handleApiError, successResponse } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// GET - List all content versions
export async function GET() {
  try {
    await requireAdmin();

    const versions = await ContentManagementService.listVersions();

    return successResponse({ versions });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST - Create a new content version
export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();

    const body = await req.json();
    const { version, routerContent, cursorRulesContent, claudeMdContent, modulesContent, changelog } = body;

    if (!version) {
      return successResponse({ error: 'Version is required' }, 400);
    }

    const newVersion = await ContentManagementService.createVersion(session.user.id, {
      version,
      routerContent,
      cursorRulesContent,
      claudeMdContent,
      modulesContent,
      changelog,
    });

    return successResponse({ version: newVersion });
  } catch (error) {
    return handleApiError(error);
  }
}
