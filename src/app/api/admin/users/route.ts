import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { AdminService } from '@/services/admin-service';
import { handleApiError, successResponse, autoRateLimit } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    autoRateLimit(req);
    await requireAdmin();

    const users = await AdminService.listUsers();
    const stats = await AdminService.getUserStats();

    return successResponse({ users, stats });
  } catch (error) {
    return handleApiError(error);
  }
}
