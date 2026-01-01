import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/auth';
import { ContentManagementService } from '@/services/content-management-service';
import { autoRateLimit } from '@/lib/api-utils';
import { db } from '@/db';
import { productionFeedback, patternCompliance, architectureConflicts } from '@/db/schema';
import { desc, sql, avg } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * Get the next sequential module number based on existing modules
 */
function getNextModuleNumber(existingModules: string[]): number {
  const moduleNumbers = existingModules
    .map(name => {
      const match = name.match(/^(\d+)-/);
      return match ? parseInt(match[1], 10) : null;
    })
    .filter((n): n is number => n !== null);

  if (moduleNumbers.length === 0) return 0;
  return Math.max(...moduleNumbers) + 1;
}

/**
 * Fetch v6.1 insights for module creation context
 */
async function getV61Insights() {
  // Get recent production errors (patterns causing issues)
  const recentErrors = await db.query.productionFeedback.findMany({
    where: sql`${productionFeedback.isResolved} = false`,
    orderBy: [desc(productionFeedback.occurrenceCount)],
    limit: 10,
  });

  // Get patterns with low compliance scores
  const lowCompliancePatterns = await db
    .select({
      pattern: patternCompliance.patternsChecked,
      avgScore: avg(patternCompliance.complianceScore),
    })
    .from(patternCompliance)
    .groupBy(patternCompliance.patternsChecked)
    .orderBy(sql`avg(${patternCompliance.complianceScore}) ASC`)
    .limit(5);

  // Get common architecture conflicts
  const commonConflicts = await db.query.architectureConflicts.findMany({
    where: sql`${architectureConflicts.isResolved} = false`,
    orderBy: [desc(architectureConflicts.createdAt)],
    limit: 10,
  });

  return {
    recentErrors,
    lowCompliancePatterns,
    commonConflicts,
  };
}

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
- CRITICAL: Use the EXACT next sequential number provided in the context (nextModuleNumber)
- Never skip numbers or reuse existing numbers
- Include proper markdown formatting with ## headers
- Add TypeScript code examples with proper error handling
- Include common patterns, anti-patterns, and best practices
- Be comprehensive but focused on the topic
- Consider v6.1 insights (production errors, compliance issues, conflicts) when relevant

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

    // Get v6.1 insights for better module creation
    const v61Insights = await getV61Insights();

    let contextMessage = '';
    if (activeVersion) {
      contextMessage = `\n\nCurrent active content version: ${activeVersion.version}\n`;
      if (activeVersion.claudeMdContent) {
        contextMessage += `\nCurrent CLAUDE.md (${activeVersion.claudeMdContent.split('\n').length} lines):\n${activeVersion.claudeMdContent.substring(0, 2000)}...\n`;
      }
      if (activeVersion.modulesContent) {
        const moduleNames = Object.keys(activeVersion.modulesContent);
        const nextNumber = getNextModuleNumber(moduleNames);
        contextMessage += `\nExisting modules: ${moduleNames.join(', ')}\n`;
        contextMessage += `\n**IMPORTANT - Next module number: ${nextNumber}** (use ${nextNumber.toString().padStart(2, '0')}-modulename.md format)\n`;
      }
    }

    // Add v6.1 insights to context
    if (v61Insights.recentErrors.length > 0) {
      contextMessage += `\n\n## v6.1 Production Insights\n`;
      contextMessage += `\n### Recent Production Errors (consider addressing in patterns):\n`;
      v61Insights.recentErrors.slice(0, 5).forEach(err => {
        contextMessage += `- ${err.errorType}: ${err.errorMessage} (${err.occurrenceCount}x) - Pattern: ${err.patternUsed || 'unknown'}\n`;
      });
    }

    if (v61Insights.lowCompliancePatterns.length > 0) {
      contextMessage += `\n### Low Compliance Patterns (may need clarification):\n`;
      v61Insights.lowCompliancePatterns.forEach(p => {
        if (p.pattern && p.avgScore) {
          contextMessage += `- Pattern group avg score: ${Number(p.avgScore).toFixed(0)}/100\n`;
        }
      });
    }

    if (v61Insights.commonConflicts.length > 0) {
      contextMessage += `\n### Common Architecture Conflicts (add warnings for these):\n`;
      const conflictTypes = new Set(v61Insights.commonConflicts.map(c => c.conflictType));
      conflictTypes.forEach(type => {
        const conflicts = v61Insights.commonConflicts.filter(c => c.conflictType === type);
        const items = conflicts.map(c => JSON.parse(c.conflictingItems || '[]')).flat();
        const uniqueItems = [...new Set(items)];
        if (uniqueItems.length > 0) {
          contextMessage += `- ${type}: ${uniqueItems.join(' vs ')}\n`;
        }
      });
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
