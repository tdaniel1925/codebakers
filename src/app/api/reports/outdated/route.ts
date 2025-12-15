import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyService } from '@/services/api-key-service';
import { db, moduleReports } from '@/db';
import { eq, and, gte, desc } from 'drizzle-orm';
import { Resend } from 'resend';
import { handleApiError, successResponse } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'daniel@botmakers.ai';
const NOTIFY_THRESHOLD = 3;

// POST - Submit a new report (CLI users)
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const apiKey = authHeader.slice(7);
    const validation = await ApiKeyService.validate(apiKey);

    if (!validation.valid || !validation.team) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const body = await req.json();
    const { moduleName, issue, modulePattern, currentPattern, sourceUrl } = body;

    if (!moduleName || !issue) {
      return NextResponse.json(
        { error: 'moduleName and issue are required' },
        { status: 400 }
      );
    }

    // Insert report
    const [report] = await db
      .insert(moduleReports)
      .values({
        moduleName,
        issue,
        modulePattern: modulePattern || null,
        currentPattern: currentPattern || null,
        sourceUrl: sourceUrl || null,
        teamId: validation.team.id,
      })
      .returning();

    // Check if we should notify (3+ pending reports for this module in last 7 days)
    const recentReports = await db
      .select()
      .from(moduleReports)
      .where(
        and(
          eq(moduleReports.moduleName, moduleName),
          eq(moduleReports.status, 'pending'),
          gte(moduleReports.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        )
      );

    if (recentReports.length === NOTIFY_THRESHOLD && resend) {
      try {
        await resend.emails.send({
          from: 'CodeBakers <alerts@codebakers.dev>',
          to: ADMIN_EMAIL,
          subject: `Module Update Needed: ${moduleName}`,
          html: `
            <h2>Module "${moduleName}" has ${recentReports.length} reports</h2>
            <p><strong>Latest issue:</strong> ${issue}</p>
            ${sourceUrl ? `<p><strong>Source:</strong> <a href="${sourceUrl}">${sourceUrl}</a></p>` : ''}
            <h3>Recent Reports:</h3>
            <ul>
              ${recentReports.map(r => `<li>${r.issue} (${r.createdAt?.toISOString().split('T')[0]})</li>`).join('')}
            </ul>
            <p><a href="https://codebakers.dev/admin/reports">View Dashboard</a></p>
          `,
        });
      } catch (emailError) {
        console.error('Failed to send notification email:', emailError);
      }
    }

    return successResponse({
      reportId: report.id,
      message: 'Report submitted. Thanks for helping keep CodeBakers current!',
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// GET - List reports (for admin dashboard)
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const reports = await db
      .select()
      .from(moduleReports)
      .orderBy(desc(moduleReports.createdAt));

    // Group by module
    const grouped = reports.reduce(
      (acc, report) => {
        if (!acc[report.moduleName]) {
          acc[report.moduleName] = {
            moduleName: report.moduleName,
            pendingCount: 0,
            totalCount: 0,
            reports: [] as typeof reports,
          };
        }
        acc[report.moduleName].totalCount++;
        if (report.status === 'pending') {
          acc[report.moduleName].pendingCount++;
        }
        acc[report.moduleName].reports.push(report);
        return acc;
      },
      {} as Record<string, { moduleName: string; pendingCount: number; totalCount: number; reports: typeof reports }>
    );

    return successResponse({
      modules: Object.values(grouped).sort((a, b) => b.pendingCount - a.pendingCount),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
