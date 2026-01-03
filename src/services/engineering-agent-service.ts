/**
 * ENGINEERING AGENT SERVICE
 *
 * The AI brain that executes each phase of the engineering workflow.
 * Designed for ZERO FRICTION - user just describes what they want,
 * and the agents build it automatically.
 *
 * Flow:
 * 1. User enters project name + optional description
 * 2. AI generates detailed scope from description
 * 3. Each phase executes automatically
 * 4. User watches progress, no action required
 */

import { createMessage } from '@/lib/anthropic';
import {
  ProjectScope,
  ProjectContext,
  EngineeringPhase,
  AgentRole,
  ENGINEERING_PHASES,
  AGENT_CONFIGS,
} from '@/lib/engineering-types';
import { EngineeringOrchestratorService } from './engineering-orchestrator-service';
import { ContentService } from './content-service';
import { db } from '@/db';
import { engineeringSessions, engineeringMessages } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// =============================================================================
// PATTERN LOADING (Server-side only - patterns never shipped to user)
// =============================================================================

/**
 * Load relevant pattern modules from server based on project requirements
 * These patterns guide code generation but stay server-side
 */
async function loadRelevantPatterns(ctx: ProjectContext): Promise<string> {
  const content = await ContentService.getRawContent();
  const modules = content.modules || {};

  // Always include core patterns
  const relevantModules: string[] = ['00-core.md'];

  // Add modules based on project requirements
  if (ctx.scope.hasAuth) relevantModules.push('02-auth.md');
  if (ctx.scope.hasPayments) relevantModules.push('05-payments.md');
  if (ctx.scope.hasRealtime) relevantModules.push('11-realtime.md');
  if (ctx.scope.compliance.hipaa) relevantModules.push('22-experts-health.md');
  if (ctx.scope.compliance.pci) relevantModules.push('23-experts-finance.md');

  // Always include these for any project
  relevantModules.push('01-database.md', '03-api.md', '04-frontend.md');

  // Build pattern content string
  const patternSections: string[] = [];

  for (const moduleName of relevantModules) {
    const moduleContent = modules[moduleName];
    if (moduleContent && typeof moduleContent === 'string') {
      // Truncate very long modules to fit in context
      const truncated = moduleContent.length > 8000
        ? moduleContent.substring(0, 8000) + '\n... [truncated]'
        : moduleContent;
      patternSections.push(`\n### ${moduleName}\n${truncated}`);
    }
  }

  return patternSections.join('\n');
}

// =============================================================================
// AGENT PROMPTS
// =============================================================================

const AGENT_PROMPTS: Record<AgentRole, (ctx: ProjectContext) => string> = {
  orchestrator: (ctx: ProjectContext) => `
You are the Engineering Orchestrator for CodeBakers.
Your job is to coordinate the build process for: ${ctx.scope.name}

Project Description: ${ctx.scope.description || 'Not provided - infer from name'}

Analyze this project and provide a high-level build strategy.
`,

  pm: (ctx: ProjectContext) => `
You are a Product Manager AI agent.

Create a comprehensive PRD (Product Requirements Document) for:
**${ctx.scope.name}**

Description: ${ctx.scope.description || 'Infer from project name'}

Target Audience: ${ctx.scope.targetAudience}
Platforms: ${ctx.scope.platforms.join(', ')}
Has Authentication: ${ctx.scope.hasAuth}
Has Payments: ${ctx.scope.hasPayments}
Has Realtime: ${ctx.scope.hasRealtime}
Compliance: ${Object.entries(ctx.scope.compliance).filter(([,v]) => v).map(([k]) => k.toUpperCase()).join(', ') || 'None'}

Generate a complete PRD in markdown format with:
1. Executive Summary
2. Problem Statement
3. Target Users & Personas
4. Core Features (prioritized as P0, P1, P2)
5. User Stories (at least 10)
6. Success Metrics
7. Out of Scope (v1)
8. Timeline Estimates

Be specific and actionable. This PRD will drive the entire build.
`,

  architect: (ctx: ProjectContext) => `
You are a Software Architect AI agent.

Create a technical architecture document for:
**${ctx.scope.name}**

Tech Stack:
- Framework: ${ctx.stack.framework}
- Database: ${ctx.stack.database}
- ORM: ${ctx.stack.orm}
- Auth: ${ctx.stack.auth}
- UI: ${ctx.stack.ui}
${ctx.stack.payments ? `- Payments: ${ctx.stack.payments}` : ''}

Project Requirements:
${ctx.artifacts.prd ? ctx.artifacts.prd.substring(0, 2000) + '...' : 'See scope'}

Generate a complete technical spec with:
1. System Architecture Overview
2. Database Schema (Drizzle format)
3. API Routes Structure
4. Component Hierarchy
5. State Management Approach
6. Authentication Flow
7. Key Technical Decisions
8. File/Folder Structure
9. Third-Party Integrations
10. Performance Considerations

Output production-ready specifications.
`,

  engineer: (ctx: ProjectContext) => `
You are a Full-Stack Software Engineer AI agent following CodeBakers patterns.

Generate the COMPLETE implementation for:
**${ctx.scope.name}**

Tech Stack:
- Framework: Next.js 14 (App Router)
- Database: PostgreSQL via Supabase
- ORM: Drizzle
- Auth: Supabase Auth
- UI: shadcn/ui components + Tailwind CSS
- Forms: React Hook Form + Zod validation
- State: React hooks (useState, useEffect)

CodeBakers Pattern Requirements:
- API routes MUST have try/catch error handling with NextResponse.json
- All forms MUST use React Hook Form + Zod
- Database queries MUST use Drizzle ORM patterns
- Auth MUST use Supabase createClient() pattern
- Components MUST be TypeScript with proper types
- NO console.log in production code
- NO @ts-ignore or @ts-nocheck

Based on the architecture:
${ctx.artifacts.techSpec ? ctx.artifacts.techSpec.substring(0, 4000) + '...' : 'See PRD'}

OUTPUT FORMAT:
For each file, output in this exact format:
===FILE: path/to/file.ts===
[file contents here]
===END FILE===

Generate these files:
1. src/db/schema.ts - Drizzle schema
2. src/db/index.ts - Database client
3. src/app/api/[resource]/route.ts - API routes
4. src/app/page.tsx - Home page
5. src/app/[feature]/page.tsx - Feature pages
6. src/components/[name].tsx - React components
7. src/lib/[utils].ts - Utility functions
8. package.json - Dependencies

Generate COMPLETE, RUNNABLE code. No placeholders like "// TODO" or "// implement here".
`,

  security: (ctx: ProjectContext) => `
You are a Security Engineer AI agent.

Perform a security audit for:
**${ctx.scope.name}**

Compliance Requirements: ${Object.entries(ctx.scope.compliance).filter(([,v]) => v).map(([k]) => k.toUpperCase()).join(', ') || 'Standard security'}
Has Payments: ${ctx.scope.hasPayments}
Has Auth: ${ctx.scope.hasAuth}

Review the generated code and architecture for:
1. Authentication vulnerabilities
2. Authorization issues
3. Input validation gaps
4. SQL injection risks
5. XSS vulnerabilities
6. CSRF protection
7. Rate limiting needs
8. Data encryption requirements
9. Compliance checklist
10. Recommended security headers

Output a detailed security audit report with specific findings and fixes.
`,

  qa: (ctx: ProjectContext) => `
You are a QA Engineer AI agent.

Create a comprehensive test plan for:
**${ctx.scope.name}**

Based on the PRD and implementation, generate:
1. Unit test cases (Vitest)
2. Integration test cases
3. E2E test scenarios (Playwright)
4. Edge case testing
5. Error handling tests
6. Performance test scenarios
7. Security test cases

Output actual test code where possible.
`,

  documentation: (ctx: ProjectContext) => `
You are a Technical Writer AI agent.

Create comprehensive documentation for:
**${ctx.scope.name}**

Generate:
1. User Guide - how to use the application
2. API Documentation - all endpoints with examples
3. Setup Guide - how to deploy and configure
4. Architecture Overview - for developers
5. Troubleshooting Guide - common issues and solutions

Make documentation clear, complete, and beginner-friendly.
`,

  devops: (ctx: ProjectContext) => `
You are a DevOps Engineer AI agent.

Create deployment configuration for:
**${ctx.scope.name}**

Target Platform: Vercel (inferred from Next.js)
Database: ${ctx.stack.database}

Generate:
1. Environment variables list
2. Deployment checklist
3. CI/CD pipeline config (GitHub Actions)
4. Monitoring setup recommendations
5. Scaling considerations
6. Backup strategy
7. Rollback procedures

Output production-ready configurations.
`,
};

// =============================================================================
// PHASE EXECUTION
// =============================================================================

/**
 * Execute a single phase with AI
 */
async function executePhase(
  sessionId: string,
  phase: EngineeringPhase,
  context: ProjectContext
): Promise<{ success: boolean; artifact?: string; error?: string }> {
  const phaseConfig = ENGINEERING_PHASES.find(p => p.phase === phase);
  if (!phaseConfig) return { success: false, error: 'Unknown phase' };

  const agentConfig = AGENT_CONFIGS[phaseConfig.agent];
  const promptFn = AGENT_PROMPTS[phaseConfig.agent];

  if (!promptFn) {
    return { success: false, error: `No prompt defined for agent: ${phaseConfig.agent}` };
  }

  try {
    // Log start
    await logMessage(sessionId, phaseConfig.agent, 'orchestrator', 'status',
      `Starting ${phaseConfig.displayName} phase...`);

    // Build the prompt
    let userPrompt = promptFn(context);

    // For engineer phase, inject actual CodeBakers patterns from server
    // Patterns are used for generation but NEVER shipped to user
    if (phaseConfig.agent === 'engineer') {
      const patterns = await loadRelevantPatterns(context);
      userPrompt = `${userPrompt}

## CODEBAKERS PATTERNS (Follow these EXACTLY - server-enforced)
${patterns}

CRITICAL: Generate code that follows these patterns exactly. The patterns above are the authoritative source.
`;
    }

    const systemPrompt = `You are ${agentConfig.displayName}, part of CodeBakers' AI engineering team.
${agentConfig.systemPromptAdditions}

Your focus areas:
${agentConfig.focusAreas.map(f => `- ${f}`).join('\n')}

Respond with high-quality, production-ready output. Be thorough but concise.`;

    // Call AI
    const response = await createMessage({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    // Extract content
    const content = response.content[0];
    if (content.type !== 'text') {
      return { success: false, error: 'Unexpected response type' };
    }

    const artifact = content.text;

    // Log completion
    await logMessage(sessionId, phaseConfig.agent, 'orchestrator', 'artifact',
      `Completed ${phaseConfig.displayName}`, { artifactLength: artifact.length });

    // Update token usage
    await db.update(engineeringSessions)
      .set({
        totalApiCalls: (await getApiCalls(sessionId)) + 1,
        totalTokensUsed: (await getTokensUsed(sessionId)) + (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
      })
      .where(eq(engineeringSessions.id, sessionId));

    return { success: true, artifact };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await logMessage(sessionId, phaseConfig.agent, 'orchestrator', 'error',
      `Error in ${phaseConfig.displayName}: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

/**
 * Map phase to artifact type
 */
function getArtifactType(phase: EngineeringPhase): keyof ProjectContext['artifacts'] | null {
  const mapping: Partial<Record<EngineeringPhase, keyof ProjectContext['artifacts']>> = {
    requirements: 'prd',
    architecture: 'techSpec',
    implementation: 'techSpec', // Append to tech spec
    documentation: 'userGuide',
    security_review: 'securityAudit',
  };
  return mapping[phase] || null;
}

// =============================================================================
// AUTO-BUILD ORCHESTRATION
// =============================================================================

/**
 * Run the complete build automatically
 * This is the main entry point for zero-friction builds
 *
 * Flow:
 * 1. Generate base project files (CLAUDE.md, .cursorrules, configs)
 * 2. Run AI phases to generate PRD, specs, and code
 * 3. Parse AI output to extract actual code files
 * 4. Store all files in database for CLI to download
 */
export async function runAutoBuild(sessionId: string): Promise<void> {
  // Mark session as running
  await db.update(engineeringSessions)
    .set({ isRunning: true, status: 'active' })
    .where(eq(engineeringSessions.id, sessionId));

  try {
    // Load session
    const session = await EngineeringOrchestratorService.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    let context = session.context;
    let allFiles: GeneratedFile[] = [];

    // Auto-infer scope from description if minimal input
    if (!context.scope.description && context.scope.name) {
      context = await autoInferScope(sessionId, context);
    }

    // Step 1: Generate base project files (v6.0 bootstrap - patterns stay server-side)
    await logMessage(sessionId, 'orchestrator', 'all', 'status',
      'Generating base project structure (patterns enforced server-side via MCP)...');

    const baseFiles = generateBaseFiles(context.scope.name);
    allFiles = [...baseFiles];
    await saveGeneratedFiles(sessionId, allFiles);

    await logMessage(sessionId, 'orchestrator', 'all', 'status',
      `Generated ${baseFiles.length} base files (v6.0 bootstrap, configs)`);

    // Step 2: Execute each phase in order
    const phases = ENGINEERING_PHASES.filter(p => p.phase !== 'scoping'); // Skip scoping, already done

    for (const phaseConfig of phases) {
      // Check if session was paused
      const currentSession = await EngineeringOrchestratorService.getSession(sessionId);
      if (!currentSession?.isRunning) {
        await logMessage(sessionId, 'orchestrator', 'all', 'status', 'Build paused');
        return;
      }

      // Update current phase
      await db.update(engineeringSessions)
        .set({
          currentPhase: phaseConfig.phase,
          currentAgent: phaseConfig.agent,
          lastActivityAt: new Date(),
        })
        .where(eq(engineeringSessions.id, sessionId));

      // Mark phase as in progress
      const gateStatus = context.gateStatus;
      gateStatus[phaseConfig.phase] = {
        phase: phaseConfig.phase,
        status: 'in_progress',
      };
      await updateGateStatus(sessionId, gateStatus);

      // Execute phase
      const result = await executePhase(sessionId, phaseConfig.phase, context);

      if (result.success && result.artifact) {
        // Store artifact
        const artifactType = getArtifactType(phaseConfig.phase);
        if (artifactType) {
          context.artifacts[artifactType] = result.artifact;
          await updateArtifacts(sessionId, context.artifacts);
        }

        // For implementation phase, parse the AI response to extract files
        if (phaseConfig.phase === 'implementation' && result.artifact) {
          const codeFiles = parseFilesFromResponse(result.artifact);
          if (codeFiles.length > 0) {
            allFiles = [...allFiles, ...codeFiles];
            await saveGeneratedFiles(sessionId, allFiles);

            await logMessage(sessionId, 'engineer', 'orchestrator', 'status',
              `Generated ${codeFiles.length} code files`);
          }
        }

        // Mark phase as passed
        gateStatus[phaseConfig.phase] = {
          phase: phaseConfig.phase,
          status: 'passed',
          passedAt: new Date(),
          approvedBy: 'auto',
          artifacts: artifactType ? [artifactType] : [],
        };
        await updateGateStatus(sessionId, gateStatus);

        // Reload context with new artifacts
        const updatedSession = await EngineeringOrchestratorService.getSession(sessionId);
        if (updatedSession) context = updatedSession.context;

      } else {
        // Mark phase as failed
        gateStatus[phaseConfig.phase] = {
          phase: phaseConfig.phase,
          status: 'failed',
          failedReason: result.error || 'Unknown error',
        };
        await updateGateStatus(sessionId, gateStatus);

        // Update session with error
        await db.update(engineeringSessions)
          .set({
            lastError: result.error,
            errorCount: (await getErrorCount(sessionId)) + 1,
          })
          .where(eq(engineeringSessions.id, sessionId));

        // Continue to next phase despite error (best effort)
        await logMessage(sessionId, 'orchestrator', 'all', 'status',
          `Phase ${phaseConfig.displayName} had issues, continuing...`);
      }

      // Small delay between phases to avoid rate limits
      await sleep(1000);
    }

    // Mark build as complete
    await db.update(engineeringSessions)
      .set({
        status: 'completed',
        isRunning: false,
        completedAt: new Date(),
        lastActivityAt: new Date(),
      })
      .where(eq(engineeringSessions.id, sessionId));

    await logMessage(sessionId, 'orchestrator', 'all', 'status',
      `Build complete! Generated ${allFiles.length} files total.`);

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    await db.update(engineeringSessions)
      .set({
        lastError: errorMsg,
        errorCount: (await getErrorCount(sessionId)) + 1,
        isRunning: false,
      })
      .where(eq(engineeringSessions.id, sessionId));

    await logMessage(sessionId, 'orchestrator', 'all', 'error',
      `Build failed: ${errorMsg}`);
  }
}

/**
 * Auto-infer project scope from name/description using AI
 * This enables zero-friction: user just types what they want
 */
async function autoInferScope(
  sessionId: string,
  context: ProjectContext
): Promise<ProjectContext> {
  await logMessage(sessionId, 'orchestrator', 'pm', 'status',
    'Analyzing project requirements...');

  try {
    const response = await createMessage({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: `You are a product analyst. Given a project name/description, infer the likely scope.
Output ONLY a JSON object with these fields (no markdown, no explanation):
{
  "description": "detailed description",
  "targetAudience": "consumers" | "businesses" | "internal" | "developers",
  "platforms": ["web"] or ["web", "mobile"] or ["api"],
  "hasAuth": true/false,
  "hasPayments": true/false,
  "hasRealtime": true/false,
  "isFullBusiness": true/false,
  "needsAdminDashboard": true/false,
  "expectedUsers": "small" | "medium" | "large" | "enterprise",
  "compliance": { "hipaa": false, "pci": false, "gdpr": false, "soc2": false, "coppa": false }
}`,
      messages: [{
        role: 'user',
        content: `Project: ${context.scope.name}\n${context.scope.description ? `Description: ${context.scope.description}` : ''}`,
      }],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      // Parse JSON from response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const inferred = JSON.parse(jsonMatch[0]);

        // Update scope
        const updatedScope: ProjectScope = {
          ...context.scope,
          description: inferred.description || context.scope.description,
          targetAudience: inferred.targetAudience || context.scope.targetAudience,
          platforms: inferred.platforms || context.scope.platforms,
          hasAuth: inferred.hasAuth ?? context.scope.hasAuth,
          hasPayments: inferred.hasPayments ?? context.scope.hasPayments,
          hasRealtime: inferred.hasRealtime ?? context.scope.hasRealtime,
          isFullBusiness: inferred.isFullBusiness ?? context.scope.isFullBusiness,
          needsAdminDashboard: inferred.needsAdminDashboard ?? context.scope.needsAdminDashboard,
          expectedUsers: inferred.expectedUsers || context.scope.expectedUsers,
          compliance: inferred.compliance || context.scope.compliance,
        };

        // Persist updated scope
        await db.update(engineeringSessions)
          .set({ scope: JSON.stringify(updatedScope) })
          .where(eq(engineeringSessions.id, sessionId));

        context.scope = updatedScope;

        await logMessage(sessionId, 'orchestrator', 'pm', 'status',
          `Scope inferred: ${updatedScope.targetAudience} app with ${updatedScope.platforms.join('/')} platform(s)`);
      }
    }
  } catch (error) {
    // Non-fatal - continue with defaults
    await logMessage(sessionId, 'orchestrator', 'pm', 'status',
      'Using default scope (inference skipped)');
  }

  return context;
}

// =============================================================================
// FILE GENERATION
// =============================================================================

interface GeneratedFile {
  id: string;
  path: string;
  content: string;
  type: 'code' | 'config' | 'doc';
}

/**
 * Parse AI response to extract individual files
 */
function parseFilesFromResponse(response: string): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const fileRegex = /===FILE:\s*(.+?)===\n([\s\S]*?)===END FILE===/g;

  let match;
  while ((match = fileRegex.exec(response)) !== null) {
    const path = match[1].trim();
    const content = match[2].trim();

    if (path && content) {
      files.push({
        id: randomUUID(),
        path,
        content,
        type: inferFileType(path),
      });
    }
  }

  return files;
}

/**
 * Infer file type from path
 */
function inferFileType(path: string): 'code' | 'config' | 'doc' {
  if (path.endsWith('.md')) return 'doc';
  if (path.endsWith('.json') || path.endsWith('.config.ts') || path.endsWith('.config.js')) return 'config';
  return 'code';
}

/**
 * Generate base project files with v6.0 server-enforced pattern system
 * Patterns stay SERVER-SIDE - generated project just gets MCP pointer
 */
function generateBaseFiles(projectName: string): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  // CLAUDE.md - bootstrap pointing to MCP server (patterns stay server-side)
  files.push({
    id: randomUUID(),
    path: 'CLAUDE.md',
    content: `# CodeBakers

**MANDATORY: Before writing ANY code, call the \`discover_patterns\` MCP tool.**

\`\`\`
Tool: discover_patterns
Args: { task: "description of what you're building" }
\`\`\`

The server will return:
- All coding patterns and rules you must follow
- Test requirements
- Validation instructions

**You cannot write code without calling this tool first. The server tracks compliance.**

---
*CodeBakers - Server-Enforced Patterns*
*Built with CodeBakers Engineering System*
`,
    type: 'config',
  });

  // .cursorrules - bootstrap for Cursor IDE
  files.push({
    id: randomUUID(),
    path: '.cursorrules',
    content: `# CodeBakers

MANDATORY: Before writing ANY code, call the discover_patterns MCP tool.

Tool: discover_patterns
Args: { task: "description of what you're building" }

The server returns all patterns, rules, and test requirements.
You cannot write code without calling this tool first.
`,
    type: 'config',
  });

  // .env.example
  files.push({
    id: randomUUID(),
    path: '.env.example',
    content: `# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database (Supabase Postgres connection string)
DATABASE_URL=postgres://user:pass@host:5432/db
`,
    type: 'config',
  });

  // tsconfig.json
  files.push({
    id: randomUUID(),
    path: 'tsconfig.json',
    content: JSON.stringify({
      compilerOptions: {
        target: 'ES2017',
        lib: ['dom', 'dom.iterable', 'esnext'],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: 'esnext',
        moduleResolution: 'bundler',
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: 'preserve',
        incremental: true,
        plugins: [{ name: 'next' }],
        paths: {
          '@/*': ['./src/*'],
        },
      },
      include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
      exclude: ['node_modules'],
    }, null, 2),
    type: 'config',
  });

  // drizzle.config.ts
  files.push({
    id: randomUUID(),
    path: 'drizzle.config.ts',
    content: `import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
`,
    type: 'config',
  });

  // tailwind.config.ts
  files.push({
    id: randomUUID(),
    path: 'tailwind.config.ts',
    content: `import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
`,
    type: 'config',
  });

  // next.config.ts
  files.push({
    id: randomUUID(),
    path: 'next.config.ts',
    content: `import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Add config options here
};

export default nextConfig;
`,
    type: 'config',
  });

  // .gitignore
  files.push({
    id: randomUUID(),
    path: '.gitignore',
    content: `# Dependencies
node_modules/
.pnpm-store/

# Build
.next/
out/
dist/
build/

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Testing
coverage/

# Misc
*.tsbuildinfo
`,
    type: 'config',
  });

  // src/lib/supabase/server.ts
  files.push({
    id: randomUUID(),
    path: 'src/lib/supabase/server.ts',
    content: `import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server component, can't set cookies
          }
        },
      },
    }
  );
}
`,
    type: 'code',
  });

  // src/lib/supabase/client.ts
  files.push({
    id: randomUUID(),
    path: 'src/lib/supabase/client.ts',
    content: `import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
`,
    type: 'code',
  });

  // src/db/index.ts
  files.push({
    id: randomUUID(),
    path: 'src/db/index.ts',
    content: `import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);

export const db = drizzle(client, { schema });
`,
    type: 'code',
  });

  // src/app/globals.css
  files.push({
    id: randomUUID(),
    path: 'src/app/globals.css',
    content: `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
}

body {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
}
`,
    type: 'code',
  });

  // src/app/layout.tsx
  files.push({
    id: randomUUID(),
    path: 'src/app/layout.tsx',
    content: `import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '${projectName}',
  description: 'Built with CodeBakers',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
`,
    type: 'code',
  });

  return files;
}

/**
 * Save generated files to database
 */
async function saveGeneratedFiles(sessionId: string, files: GeneratedFile[]): Promise<void> {
  await db.update(engineeringSessions)
    .set({ generatedFiles: JSON.stringify(files) })
    .where(eq(engineeringSessions.id, sessionId));
}

/**
 * Get existing generated files
 */
async function getGeneratedFiles(sessionId: string): Promise<GeneratedFile[]> {
  const [record] = await db
    .select({ generatedFiles: engineeringSessions.generatedFiles })
    .from(engineeringSessions)
    .where(eq(engineeringSessions.id, sessionId));

  if (record?.generatedFiles) {
    return JSON.parse(record.generatedFiles);
  }
  return [];
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function logMessage(
  sessionId: string,
  fromAgent: string,
  toAgent: string,
  messageType: string,
  content: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await db.insert(engineeringMessages).values({
    id: randomUUID(),
    sessionId,
    fromAgent,
    toAgent,
    messageType,
    content,
    metadata: metadata ? JSON.stringify(metadata) : null,
  });
}

async function updateGateStatus(
  sessionId: string,
  gateStatus: ProjectContext['gateStatus']
): Promise<void> {
  await db.update(engineeringSessions)
    .set({ gateStatus: JSON.stringify(gateStatus) })
    .where(eq(engineeringSessions.id, sessionId));
}

async function updateArtifacts(
  sessionId: string,
  artifacts: ProjectContext['artifacts']
): Promise<void> {
  await db.update(engineeringSessions)
    .set({ artifacts: JSON.stringify(artifacts) })
    .where(eq(engineeringSessions.id, sessionId));
}

async function getApiCalls(sessionId: string): Promise<number> {
  const [record] = await db.select({ totalApiCalls: engineeringSessions.totalApiCalls })
    .from(engineeringSessions)
    .where(eq(engineeringSessions.id, sessionId));
  return record?.totalApiCalls || 0;
}

async function getTokensUsed(sessionId: string): Promise<number> {
  const [record] = await db.select({ totalTokensUsed: engineeringSessions.totalTokensUsed })
    .from(engineeringSessions)
    .where(eq(engineeringSessions.id, sessionId));
  return record?.totalTokensUsed || 0;
}

async function getErrorCount(sessionId: string): Promise<number> {
  const [record] = await db.select({ errorCount: engineeringSessions.errorCount })
    .from(engineeringSessions)
    .where(eq(engineeringSessions.id, sessionId));
  return record?.errorCount || 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// EXPORTS
// =============================================================================

export { executePhase, autoInferScope };
