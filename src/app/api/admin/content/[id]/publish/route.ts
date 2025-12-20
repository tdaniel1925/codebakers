import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { ContentManagementService } from '@/services/content-management-service';
import { handleApiError, successResponse, autoRateLimit } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// POST - Publish a version (make it active)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    autoRateLimit(req);
    await requireAdmin();

    const { id } = await params;
    const version = await ContentManagementService.publishVersion(id);

    if (!version) {
      return successResponse({ error: 'Version not found' }, 404);
    }

    return successResponse({ version, message: 'Version published successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
