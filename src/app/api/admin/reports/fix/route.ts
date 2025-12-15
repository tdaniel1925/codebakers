import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/auth';
import { ContentManagementService } from '@/services/content-management-service';
import { db, moduleReports } from '@/db';
import { eq } from 'drizzle-orm';

const SYSTEM_PROMPT = `You are an AI assistant that fixes outdated code pattern modules for the CodeBakers CLI system.

You will receive:
1. A user report about an outdated or incorrect pattern
2. The current module content that needs fixing
3. Context about the current CLAUDE.md and .cursorrules files

Your job is to:
1. Understand what the user is reporting as outdated/incorrect
2. Generate the FIXED version of the relevant files
3. Only modify what's necessary to fix the reported issue

IMPORTANT:
- Do not make unnecessary changes beyond what the report asks for
- Keep all existing patterns that are still correct
- Update outdated syntax, APIs, or patterns as reported
- Add any new patterns if the report suggests something is missing

To output your fix, respond with a special JSON block:
\`\`\`json:changes
{
  "claudeMd": "full updated CLAUDE.md content or null if no changes needed",
  "cursorRules": "full updated .cursorrules content or null if no changes needed",
  "modules": {
    "XX-modulename.md": "full updated module content"
  },
  "summary": "Brief summary of what was fixed"
}
\`\`\`

Only include files that actually need to change. Generate complete, production-ready content.`;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, data: { error: 'Unauthorized' } }, { status: 401 });
    }

    const admin = await isAdmin(user.id);
    if (!admin) {
      return NextResponse.json({ success: false, data: { error: 'Admin access required' } }, { status: 403 });
    }

    const { reportId } = await request.json();

    if (!reportId) {
      return NextResponse.json(
        { success: false, data: { error: 'Report ID is required' } },
        { status: 400 }
      );
    }

    // Get the report
    const [report] = await db
      .select()
      .from(moduleReports)
      .where(eq(moduleReports.id, reportId));

    if (!report) {
      return NextResponse.json(
        { success: false, data: { error: 'Report not found' } },
        { status: 404 }
      );
    }

    // Get current active version for context
    const activeVersion = await ContentManagementService.getActiveVersion();

    // Build context for AI
    let contextMessage = '';

    if (activeVersion) {
      contextMessage = `\n\nCurrent active content version: ${activeVersion.version}\n`;

      if (activeVersion.claudeMdContent) {
        contextMessage += `\nCurrent CLAUDE.md:\n${activeVersion.claudeMdContent}\n`;
      }

      if (activeVersion.cursorRulesContent) {
        contextMessage += `\nCurrent .cursorrules:\n${activeVersion.cursorRulesContent}\n`;
      }

      if (activeVersion.modulesContent) {
        const modules = activeVersion.modulesContent as Record<string, string>;

        // Include the specific module if it exists
        const moduleKey = Object.keys(modules).find(k =>
          k.toLowerCase().includes(report.moduleName.toLowerCase().replace('.md', ''))
        );

        if (moduleKey) {
          contextMessage += `\nCurrent ${moduleKey} content:\n${modules[moduleKey]}\n`;
        }

        // List all available modules
        contextMessage += `\nAll available modules: ${Object.keys(modules).join(', ')}\n`;
      }
    }

    // Build the user message with report details
    const userMessage = `Please fix the following reported issue:

**Module:** ${report.moduleName}
**Issue:** ${report.issue}
${report.modulePattern ? `**Current pattern in module:** ${report.modulePattern}` : ''}
${report.currentPattern ? `**Correct pattern should be:** ${report.currentPattern}` : ''}
${report.sourceUrl ? `**Reference URL:** ${report.sourceUrl}` : ''}

Please analyze this report and generate the necessary fixes to update the relevant files.`;

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: SYSTEM_PROMPT + contextMessage,
      messages: [{ role: 'user', content: userMessage }],
    });

    const contentBlock = response.content[0];
    const assistantMessage = contentBlock.type === 'text' ? contentBlock.text : '';

    // Parse the changes JSON from the response
    let changes = null;
    const changesMatch = assistantMessage.match(/```json:changes\n([\s\S]*?)\n```/);
    if (changesMatch) {
      try {
        changes = JSON.parse(changesMatch[1]);
      } catch (e) {
        console.error('Failed to parse changes JSON:', e);
      }
    }

    // Clean the message for display
    const cleanMessage = assistantMessage.replace(/```json:changes\n[\s\S]*?\n```/, '').trim();

    return NextResponse.json({
      success: true,
      data: {
        message: cleanMessage,
        changes,
        report: {
          id: report.id,
          moduleName: report.moduleName,
          issue: report.issue,
        },
      },
    });
  } catch (error) {
    console.error('AI fix generation error:', error);
    return NextResponse.json(
      { success: false, data: { error: 'Failed to generate fix' } },
      { status: 500 }
    );
  }
}
