import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { AdminService } from '@/services/admin-service';
import { handleApiError, successResponse } from '@/lib/api-utils';
import { setBetaSchema } from '@/lib/validations';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
