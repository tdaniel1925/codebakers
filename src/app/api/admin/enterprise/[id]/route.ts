import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/auth';
import { db, enterpriseInquiries } from '@/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { autoRateLimit } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  status: z.enum(['new', 'contacted', 'converted', 'declined']).optional(),
  notes: z.string().max(5000).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    autoRateLimit(req);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await isAdmin(user.id);
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const result = updateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};

    if (result.data.status) {
      updates.status = result.data.status;
      if (result.data.status === 'contacted') {
        updates.respondedAt = new Date();
      }
    }

    if (result.data.notes !== undefined) {
      updates.notes = result.data.notes;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No updates provided' },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(enterpriseInquiries)
      .set(updates)
      .where(eq(enterpriseInquiries.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: 'Inquiry not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ inquiry: updated });
  } catch (error) {
    console.error('PATCH /api/admin/enterprise/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
