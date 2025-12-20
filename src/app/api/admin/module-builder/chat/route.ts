import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/auth';
import { ContentManagementService } from '@/services/content-management-service';
import { autoRateLimit } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `You are an AI assistant that helps build and update code pattern modules for the CodeBakers CLI system.

The system has 3 main files:
1. CLAUDE.md - The main router file that detects keywords and loads relevant modules
2. .cursorrules - Rules file for Cursor IDE (similar patterns to CLAUDE.md)
3. .claude/ folder - Contains module files:

   **Core Modules:**
   - 00-core.md - Core standards, error handling, quality checks
   - 01-database.md - Drizzle ORM, queries, migrations
   - 02-auth.md - Authentication, 2FA, OAuth, security
   - 03-api.md - API routes, validation, rate limits
   - 04-frontend.md - React, forms, states, i18n
   - 05-payments.md - Stripe, subscriptions
   - 06-integrations.md - Email, VAPI, files, background jobs
   - 07-performance.md - Caching, optimization
   - 08-testing.md - Tests, CI/CD, monitoring
   - 09-design.md - UI, accessibility, SEO
   - 10-generators.md - Scaffolding, templates
   - 11-realtime.md - WebSockets, notifications
   - 12-saas.md - Multi-tenant, feature flags
   - 13-mobile.md - React Native, Expo, mobile apps
   - 14-ai.md - OpenAI, Anthropic, RAG, embeddings

   **Business & Planning Modules:**
   - 15-research.md - Market research, competitive analysis, user personas
   - 16-planning.md - PRD, roadmap, feature prioritization
   - 17-marketing.md - Growth, campaigns, messaging, content
   - 18-launch.md - Launch playbook, pre/post-launch checklists
   - 19-audit.md - Pre-flight audit, 100-point inspection
   - 20-operations.md - Monitoring, runbooks, incident response

   **Expert Modules:**
   - 21-experts-core.md - Backend/frontend/security/devops experts
   - 22-experts-health.md - Healthcare, HIPAA compliance
   - 23-experts-finance.md - Fintech, PCI, banking
   - 24-experts-legal.md - Legal tech, contracts, privacy
   - 25-experts-industry.md - Ecommerce, edtech, proptech, etc.

   **Extended Modules:**
   - 26-analytics.md - PostHog, Mixpanel, funnels, metrics
   - 27-search.md - Full-text search, Algolia, autocomplete
   - 28-email-design.md - HTML emails, MJML, React Email
   - 29-data-viz.md - Charts, Recharts, D3, dashboards
   - 30-motion.md - Framer Motion, GSAP, animations
   - 31-iconography.md - Lucide, Heroicons, SVG icons
   - 32-print.md - PDF generation, React-PDF, print stylesheets

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
- Use the next available number (currently 33+)
- Include proper markdown formatting with ## headers
- Add TypeScript code examples with proper error handling
- Include common patterns, anti-patterns, and best practices
- Be comprehensive but focused on the topic

When updating CLAUDE.md router:
- Add a new section under "## STEP 2: DETECT & LOAD RELEVANT MODULES"
- Include relevant keywords that would trigger loading this module
- Add the module to the "MODULE QUICK REFERENCE" table with line count
- Add to "COMMON COMBINATIONS" section if it pairs well with other modules

IMPORTANT: The CLAUDE.md file has a "MODULE FORMAT" section that explains modules are base64 encoded.
Keep this section intact - it tells AI how to decode the .claude/ files.

Example CLAUDE.md routing section format:
\`\`\`markdown
### Module Name
**Keywords:** keyword1, keyword2, keyword3
**Load:** \`.claude/XX-modulename.md\`
\`\`\``;

export async function POST(request: NextRequest) {
  try {
    autoRateLimit(request);
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

    const { createMessage } = await import('@/lib/anthropic');
    const response = await createMessage({
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
