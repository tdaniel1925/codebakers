import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, enterpriseInquiries } from '@/db';
import { handleApiError, autoRateLimit } from '@/lib/api-utils';
import { ValidationError } from '@/lib/errors';

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

    // TODO: Send notification email to sales team
    // await sendEmail({
    //   to: 'enterprise@codebakers.dev',
    //   subject: `New Enterprise Inquiry from ${company}`,
    //   body: `Name: ${name}\nEmail: ${email}\nCompany: ${company}\nTeam Size: ${teamSize}\nUse Case: ${useCase}`,
    // });

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
