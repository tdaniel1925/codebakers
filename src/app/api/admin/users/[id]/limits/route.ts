import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { AdminService } from '@/services/admin-service';
import { handleApiError, successResponse, autoRateLimit } from '@/lib/api-utils';
import { updateLimitsSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    autoRateLimit(req);
    await requireAdmin();

    const { id } = await params;
    const body = await req.json();
    const data = updateLimitsSchema.parse(body);

    const team = await AdminService.updateTeamLimits(id, data);

    return successResponse({ team });
  } catch (error) {
    return handleApiError(error);
  }
}
