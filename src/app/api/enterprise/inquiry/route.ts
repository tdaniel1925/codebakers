import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, enterpriseInquiries } from '@/db';
import { handleApiError, autoRateLimit } from '@/lib/api-utils';
import { ValidationError } from '@/lib/errors';
import { EmailService } from '@/services/email-service';

export const dynamic = 'force-dynamic';

// Validation schema
const inquirySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Valid email required').max(255),
  company: z.string().min(1, 'Company is required').max(100),
  teamSize: z.string().max(50).optional(),
  useCase: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    autoRateLimit(req);

    // Parse and validate body
    const body = await req.json();
    const result = inquirySchema.safeParse(body);

    if (!result.success) {
      throw new ValidationError(
        'Invalid inquiry data',
        result.error.flatten().fieldErrors as Record<string, string[]>
      );
    }

    const { name, email, company, teamSize, useCase } = result.data;

    // Store inquiry in database
    const [inquiry] = await db
      .insert(enterpriseInquiries)
      .values({
        name,
        email,
        company,
        teamSize: teamSize || null,
        useCase: useCase || null,
        status: 'new',
      })
      .returning();

    // Send notification email to sales team
    try {
      await EmailService.sendEnterpriseInquiry({
        name,
        email,
        company,
        teamSize: teamSize || null,
        useCase: useCase || null,
      });
      console.log('[Enterprise Inquiry] Notification sent to sales team');
    } catch (emailError) {
      // Log but don't fail the request - inquiry is already saved
      console.error('[Enterprise Inquiry] Failed to send notification:', emailError);
    }

    console.log('[Enterprise Inquiry] New inquiry received:', {
      id: inquiry.id,
      company,
      email,
    });

    return NextResponse.json({
      success: true,
      message: 'Inquiry submitted successfully',
    });
  } catch (error) {
    console.error('POST /api/enterprise/inquiry error:', error);
    return handleApiError(error);
  }
}
