import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { AdminService } from '@/services/admin-service';
import { handleApiError, successResponse } from '@/lib/api-utils';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();

    const { id } = await params;

    await AdminService.resetTrialDownloads(id);

    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
