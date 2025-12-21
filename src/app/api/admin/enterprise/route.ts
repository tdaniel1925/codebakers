import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/auth';
import { db, enterpriseInquiries } from '@/db';
import { desc, eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
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

    // Fetch all enterprise inquiries
    const inquiries = await db
      .select()
      .from(enterpriseInquiries)
      .orderBy(desc(enterpriseInquiries.createdAt));

    // Calculate stats
    const statsResult = await db
      .select({
        status: enterpriseInquiries.status,
        count: sql<number>`count(*)::int`,
      })
      .from(enterpriseInquiries)
      .groupBy(enterpriseInquiries.status);

    const stats = {
      total: inquiries.length,
      new: 0,
      contacted: 0,
      converted: 0,
      declined: 0,
    };

    for (const row of statsResult) {
      if (row.status === 'new') stats.new = row.count;
      if (row.status === 'contacted') stats.contacted = row.count;
      if (row.status === 'converted') stats.converted = row.count;
      if (row.status === 'declined') stats.declined = row.count;
    }

    return NextResponse.json({ inquiries, stats });
  } catch (error) {
    console.error('GET /api/admin/enterprise error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
