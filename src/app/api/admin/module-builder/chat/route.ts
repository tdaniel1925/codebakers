import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';
import { ContentManagementService } from '@/services/content-management-service';

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are an AI assistant that helps build and update code pattern modules for the CodeBakers CLI system.

The system has 3 main files:
1. CLAUDE.md - The main router file that detects keywords and loads relevant modules
2. .cursorrules - Rules file for Cursor IDE (similar patterns to CLAUDE.md)
3. .claude/ folder - Contains module files like:
   - 00-core.md - Core standards, error handling, quality checks
   - 01-database.md - Drizzle ORM, queries, migrations
   - 02-auth.md - Authentication, 2FA, OAuth, security
   - 03-api.md - API routes, validation, rate limits
   - 04-frontend.md - React, forms, states
   - 05-payments.md - Stripe, subscriptions
   - 06-integrations.md - Email, VAPI, files, background jobs
   - 07-performance.md - Caching, optimization
   - 08-testing.md - Tests, CI/CD, monitoring
   - 09-design.md - UI, accessibility, SEO
   - 10-generators.md - Scaffolding, templates
   - 11-realtime.md - WebSockets, notifications
   - 12-saas.md - Multi-tenant, feature flags

When the user asks to create or update modules:
1. First discuss and understand what they want
2. Ask clarifying questions if needed
3. When you have enough information, generate the actual content

To generate changes, respond with a special JSON block at the end of your message:
\`\`\`json:changes
{
  "claudeMd": "full updated CLAUDE.md content or null",
  "cursorRules": "full updated .cursorrules content or null",
  "modules": {
    "XX-modulename.md": "full module content"
  },
  "summary": "Brief summary of changes"
}
\`\`\`

Only include files that need to change. Generate complete, production-ready content following the existing module patterns.

When creating new modules:
- Follow the existing naming convention (XX-name.md)
- Include proper markdown formatting
- Add code examples with TypeScript
- Include error handling patterns
- Be comprehensive but focused

When updating CLAUDE.md router:
- Add keywords for the new module
- Add the module to the quick reference table
- Update common combinations if relevant`;

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

    const { messages } = await request.json();

    // Get current active version to provide context
    const activeVersion = await ContentManagementService.getActiveVersion();

    let contextMessage = '';
    if (activeVersion) {
      contextMessage = `\n\nCurrent active content version: ${activeVersion.version}\n`;
      if (activeVersion.claudeMdContent) {
        contextMessage += `\nCurrent CLAUDE.md (${activeVersion.claudeMdContent.split('\n').length} lines):\n${activeVersion.claudeMdContent.substring(0, 2000)}...\n`;
      }
      if (activeVersion.modulesContent) {
        const moduleNames = Object.keys(activeVersion.modulesContent);
        contextMessage += `\nExisting modules: ${moduleNames.join(', ')}\n`;
      }
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: SYSTEM_PROMPT + contextMessage,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    const contentBlock = response.content[0];
    const assistantMessage = contentBlock.type === 'text' ? contentBlock.text : '';

    // Check if AI generated changes
    let changes = null;
    const changesMatch = assistantMessage.match(/```json:changes\n([\s\S]*?)\n```/);
    if (changesMatch) {
      try {
        changes = JSON.parse(changesMatch[1]);
      } catch (e) {
        console.error('Failed to parse changes JSON:', e);
      }
    }

    // Remove the JSON block from the displayed message
    const cleanMessage = assistantMessage.replace(/```json:changes\n[\s\S]*?\n```/, '').trim();

    return NextResponse.json({
      success: true,
      data: {
        message: cleanMessage,
        changes,
      },
    });
  } catch (error) {
    console.error('Module builder chat error:', error);
    return NextResponse.json(
      { success: false, data: { error: 'Failed to process message' } },
      { status: 500 }
    );
  }
}
