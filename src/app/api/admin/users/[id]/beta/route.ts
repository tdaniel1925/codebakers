import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { AdminService } from '@/services/admin-service';
import { handleApiError, successResponse, autoRateLimit } from '@/lib/api-utils';
import { setBetaSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    autoRateLimit(req);
    await requireAdmin();

    const { id } = await params;
    const body = await req.json();
    const { enabled, reason } = setBetaSchema.parse(body);

    await AdminService.setBetaTier(id, enabled, reason);

    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
