import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { AdminService } from '@/services/admin-service';
import { handleApiError, successResponse, autoRateLimit } from '@/lib/api-utils';
import { suspendSchema } from '@/lib/validations';

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
    const { suspended, reason } = suspendSchema.parse(body);

    if (suspended) {
      if (!reason) {
        return NextResponse.json(
          { error: 'Reason is required when suspending' },
          { status: 400 }
        );
      }
      await AdminService.suspendTeam(id, reason);
    } else {
      await AdminService.unsuspendTeam(id);
    }

    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
