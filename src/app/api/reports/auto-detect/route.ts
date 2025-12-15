import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyService } from '@/services/api-key-service';
import { db, moduleReports } from '@/db';
import { eq, and, gte } from 'drizzle-orm';
import { Resend } from 'resend';
import { handleApiError, successResponse } from '@/lib/api-utils';
import { ContentManagementService } from '@/services/content-management-service';

export const dynamic = 'force-dynamic';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'daniel@botmakers.ai';

const ANALYSIS_PROMPT = `You are an AI that analyzes code errors to determine if they are caused by outdated patterns in a code pattern library.

You will receive:
1. An error message or failed code snippet from a user
2. The module/pattern they were trying to use
3. The current pattern content from our library

Your job is to determine:
1. Is this error caused by an OUTDATED PATTERN in our library? (API changed, deprecated method, wrong syntax for current version)
2. Or is it a USER ERROR? (typo, wrong usage, missing dependencies, environment issue)

IMPORTANT CRITERIA for reporting as outdated:
- The pattern uses a deprecated API or method
- The pattern has syntax that no longer works in current versions
- The pattern references packages/imports that have changed
- The pattern is missing required error handling that's now mandatory
- The pattern uses old naming conventions that frameworks have changed

DO NOT report as outdated if:
- User made a typo
- User didn't install required dependencies
- User has environment/config issues
- User is using the pattern incorrectly
- Error is unrelated to the pattern

Respond with JSON only:
{
  "isOutdatedPattern": true/false,
  "confidence": "high"/"medium"/"low",
  "reason": "Brief explanation of why this is or isn't a pattern issue",
  "suggestedFix": "If outdated, what should the pattern be changed to",
  "moduleName": "Which module file needs updating (e.g., 01-database.md)",
  "currentPattern": "The problematic code from our pattern",
  "correctPattern": "What it should be changed to"
}`;

export async function POST(req: NextRequest) {
  try {
    // Validate API key
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
    const {
      errorMessage,
      codeSnippet,
      moduleName,
      framework,
      packageVersions
    } = body;

    if (!errorMessage && !codeSnippet) {
      return NextResponse.json(
        { error: 'Either errorMessage or codeSnippet is required' },
        { status: 400 }
      );
    }

    // Get current active version to provide pattern context
    const activeVersion = await ContentManagementService.getActiveVersion();

    let moduleContent = '';
    if (activeVersion?.modulesContent && moduleName) {
      const modules = activeVersion.modulesContent as Record<string, string>;
      // Find matching module
      const moduleKey = Object.keys(modules).find(k =>
        k.toLowerCase().includes(moduleName.toLowerCase().replace('.md', ''))
      );
      if (moduleKey) {
        moduleContent = modules[moduleKey];
      }
    }

    // Build context for AI analysis
    const analysisMessage = `Please analyze this error/code issue:

**Error Message:**
${errorMessage || 'Not provided'}

**Code Snippet:**
\`\`\`
${codeSnippet || 'Not provided'}
\`\`\`

**Module Being Used:** ${moduleName || 'Unknown'}
**Framework/Stack:** ${framework || 'Not specified'}
**Package Versions:** ${packageVersions ? JSON.stringify(packageVersions) : 'Not provided'}

**Current Pattern in Our Library:**
${moduleContent ? moduleContent.substring(0, 3000) + '...' : 'Module not found'}

Is this an outdated pattern issue or a user error?`;

    const { createMessage } = await import('@/lib/anthropic');
    const response = await createMessage({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: ANALYSIS_PROMPT,
      messages: [{ role: 'user', content: analysisMessage }],
    });

    const contentBlock = response.content[0];
    const responseText = contentBlock.type === 'text' ? contentBlock.text : '';

    // Parse AI response
    let analysis;
    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON in response');
      }
    } catch (e) {
      return successResponse({
        autoReported: false,
        reason: 'Could not analyze the issue',
        rawAnalysis: responseText,
      });
    }

    // If it's an outdated pattern with high/medium confidence, auto-create report
    if (analysis.isOutdatedPattern && ['high', 'medium'].includes(analysis.confidence)) {
      // Check for duplicate reports (same module, similar issue in last 7 days)
      const recentReports = await db
        .select()
        .from(moduleReports)
        .where(
          and(
            eq(moduleReports.moduleName, analysis.moduleName || moduleName || 'unknown'),
            eq(moduleReports.status, 'pending'),
            gte(moduleReports.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
          )
        );

      // Only create if no similar recent report exists
      const isDuplicate = recentReports.some(r =>
        r.issue.toLowerCase().includes(analysis.reason.toLowerCase().substring(0, 50))
      );

      if (!isDuplicate) {
        const [report] = await db
          .insert(moduleReports)
          .values({
            moduleName: analysis.moduleName || moduleName || 'unknown',
            issue: `[Auto-detected] ${analysis.reason}`,
            modulePattern: analysis.currentPattern || null,
            currentPattern: analysis.correctPattern || analysis.suggestedFix || null,
            teamId: validation.team.id,
          })
          .returning();

        // Notify admin if this is a high-confidence issue
        if (analysis.confidence === 'high' && resend) {
          try {
            await resend.emails.send({
              from: 'CodeBakers <alerts@codebakers.dev>',
              to: ADMIN_EMAIL,
              subject: `[Auto-Detected] Outdated Pattern: ${analysis.moduleName || moduleName}`,
              html: `
                <h2>AI Auto-Detected Outdated Pattern</h2>
                <p><strong>Module:</strong> ${analysis.moduleName || moduleName}</p>
                <p><strong>Confidence:</strong> ${analysis.confidence}</p>
                <p><strong>Issue:</strong> ${analysis.reason}</p>
                ${analysis.suggestedFix ? `<p><strong>Suggested Fix:</strong> ${analysis.suggestedFix}</p>` : ''}
                <p><a href="https://codebakers.dev/admin/reports">View in Dashboard</a></p>
              `,
            });
          } catch (emailError) {
            console.error('Failed to send notification:', emailError);
          }
        }

        return successResponse({
          autoReported: true,
          reportId: report.id,
          analysis: {
            isOutdatedPattern: analysis.isOutdatedPattern,
            confidence: analysis.confidence,
            reason: analysis.reason,
            suggestedFix: analysis.suggestedFix,
          },
          message: 'Issue auto-reported. Our team will review and fix the pattern.',
        });
      } else {
        return successResponse({
          autoReported: false,
          reason: 'Similar issue already reported',
          analysis: {
            isOutdatedPattern: analysis.isOutdatedPattern,
            confidence: analysis.confidence,
            reason: analysis.reason,
          },
        });
      }
    }

    // Not an outdated pattern issue
    return successResponse({
      autoReported: false,
      analysis: {
        isOutdatedPattern: analysis.isOutdatedPattern,
        confidence: analysis.confidence,
        reason: analysis.reason,
        suggestedFix: analysis.suggestedFix,
      },
      message: analysis.isOutdatedPattern
        ? 'Low confidence - not auto-reported. You can manually report if you believe this is a pattern issue.'
        : 'This appears to be a user error, not an outdated pattern.',
    });

  } catch (error) {
    console.error('Auto-detect error:', error);
    return handleApiError(error);
  }
}
