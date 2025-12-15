import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { ContentManagementService } from '@/services/content-management-service';
import { handleApiError, successResponse } from '@/lib/api-utils';

// GET - Get a specific version
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();

    const { id } = await params;
    const version = await ContentManagementService.getVersion(id);

    if (!version) {
      return successResponse({ error: 'Version not found' }, 404);
    }

    return successResponse({ version });
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH - Update a version
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();

    const { id } = await params;
    const body = await req.json();

    const version = await ContentManagementService.updateVersion(id, body);

    if (!version) {
      return successResponse({ error: 'Version not found' }, 404);
    }

    return successResponse({ version });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE - Delete a version
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();

    const { id } = await params;

    await ContentManagementService.deleteVersion(id);

    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
