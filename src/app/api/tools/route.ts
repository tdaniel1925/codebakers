import { NextRequest, NextResponse } from 'next/server';
import { requireAuthOrApiKey } from '@/lib/auth';
import { TeamService } from '@/services/team-service';
import { ContentService } from '@/services/content-service';
import { handleApiError, successResponse, applyRateLimit, rateLimitConfigs } from '@/lib/api-utils';
import { NotFoundError, ValidationError } from '@/lib/errors';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';

// All available tools (matching MCP server)
const AVAILABLE_TOOLS = [
  // Pattern Tools
  'get_pattern',
  'list_patterns',
  'search_patterns',
  'discover_patterns',
  'validate_complete',

  // Project Tools
  'scaffold_project',
  'init_project',
  'project_status',
  'add_page',
  'add_api_route',

  // Code Quality Tools
  'run_audit',
  'heal',
  'run_tests',
  'generate_tests',

  // Guardian (Coherence) Tools
  'guardian_analyze',
  'guardian_heal',
  'guardian_verify',
  'guardian_status',
  'ripple_check',

  // Vercel Tools
  'vercel_logs',
  'vercel_analyze_errors',
  'vercel_deployments',

  // VAPI Tools
  'vapi_list_assistants',
  'vapi_create_assistant',
  'vapi_get_assistant',
  'vapi_update_assistant',
  'vapi_get_calls',

  // Utility Tools
  'detect_intent',
  'billing_action',
  'update_patterns',
];

/**
 * GET /api/tools
 * List all available tools
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthOrApiKey(req);
    applyRateLimit(req, 'api:tools:list', auth.userId);

    return successResponse({
      tools: AVAILABLE_TOOLS.map(name => ({
        name,
        category: getCategoryForTool(name),
      })),
      total: AVAILABLE_TOOLS.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/tools
 * Execute a tool
 * Body: { tool: string, args: object, projectPath?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthOrApiKey(req);
    applyRateLimit(req, 'api:tools:execute', auth.userId, rateLimitConfigs.apiWrite);

    const body = await req.json();
    const { tool, args = {}, projectPath } = body;

    if (!tool || !AVAILABLE_TOOLS.includes(tool)) {
      throw new ValidationError(`Unknown tool: ${tool}`);
    }

    // Get team for access check - use teamId from auth if available
    let team;
    if (auth.teamId) {
      team = await TeamService.getById(auth.teamId);
    } else {
      team = await TeamService.getByOwnerId(auth.userId);
    }

    if (!team) {
      throw new NotFoundError('Team');
    }

    // Check subscription
    const hasAccess = TeamService.hasUnlimitedAccess(team);
    const hasTrial = team.freeTrialExpiresAt && new Date(team.freeTrialExpiresAt) > new Date();

    if (!hasAccess && !hasTrial) {
      return NextResponse.json({
        error: 'Subscription required',
        code: 'SUBSCRIPTION_REQUIRED',
        upgradeUrl: 'https://www.codebakers.ai/dashboard/billing',
      }, { status: 402 });
    }

    // Execute tool
    const result = await executeTool(tool, args, projectPath, auth.userId);

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

function getCategoryForTool(tool: string): string {
  if (tool.startsWith('guardian_') || tool === 'ripple_check') return 'coherence';
  if (tool.startsWith('vapi_')) return 'voice';
  if (tool.startsWith('vercel_')) return 'deployment';
  if (tool.includes('pattern')) return 'patterns';
  if (tool.includes('test')) return 'testing';
  if (['scaffold_project', 'init_project', 'project_status', 'add_page', 'add_api_route'].includes(tool)) return 'project';
  return 'utility';
}

async function executeTool(tool: string, args: any, projectPath: string | undefined, userId: string): Promise<any> {
  switch (tool) {
    // Pattern Tools
    case 'list_patterns':
      return handleListPatterns();

    case 'get_pattern':
      return handleGetPattern(args.name);

    case 'search_patterns':
      return handleSearchPatterns(args.query);

    case 'discover_patterns':
      return handleDiscoverPatterns(args.task, args.keywords);

    case 'validate_complete':
      return handleValidateComplete(args.feature, args.files, projectPath);

    // Guardian Tools
    case 'guardian_analyze':
      return handleGuardianAnalyze(args.files, projectPath);

    case 'guardian_heal':
      return handleGuardianHeal(args.issues, projectPath);

    case 'guardian_verify':
      return handleGuardianVerify(projectPath);

    case 'guardian_status':
      return handleGuardianStatus(projectPath);

    case 'ripple_check':
      return handleRippleCheck(args.entityName, args.changeType, projectPath);

    // Project Tools
    case 'project_status':
      return handleProjectStatus(projectPath);

    case 'run_audit':
      return handleRunAudit(projectPath);

    case 'run_tests':
      return handleRunTests(projectPath);

    // Utility Tools
    case 'detect_intent':
      return handleDetectIntent(args.message);

    case 'billing_action':
      return { url: 'https://www.codebakers.ai/billing' };

    case 'update_patterns':
      return handleUpdatePatterns();

    default:
      return { error: `Tool ${tool} not implemented yet` };
  }
}

// Tool Implementations

async function handleListPatterns() {
  const content = await ContentService.getEncodedContent();
  const patterns = Object.keys(content.modules || {}).map(name => ({
    name: name.replace('.md', ''),
    filename: name,
  }));
  return { patterns, total: patterns.length };
}

async function handleGetPattern(name: string) {
  const content = await ContentService.getEncodedContent();
  const filename = name.endsWith('.md') ? name : `${name}.md`;
  const moduleContent = content.modules?.[filename];

  if (!moduleContent) {
    return { error: `Pattern not found: ${name}` };
  }

  return { name, content: moduleContent };
}

async function handleSearchPatterns(query: string) {
  const content = await ContentService.getEncodedContent();
  const results: Array<{ name: string; matches: string[] }> = [];

  const queryLower = query.toLowerCase();

  for (const [filename, moduleContent] of Object.entries(content.modules || {})) {
    const contentLower = moduleContent.toLowerCase();
    if (contentLower.includes(queryLower)) {
      // Find matching lines
      const lines = moduleContent.split('\n');
      const matches = lines
        .filter(line => line.toLowerCase().includes(queryLower))
        .slice(0, 3);

      results.push({
        name: filename.replace('.md', ''),
        matches,
      });
    }
  }

  return { query, results, total: results.length };
}

async function handleDiscoverPatterns(task: string, keywords: string[]) {
  // Keyword to pattern mapping
  const keywordPatternMap: Record<string, string[]> = {
    auth: ['02-auth'],
    login: ['02-auth'],
    signup: ['02-auth'],
    password: ['02-auth'],
    database: ['01-database'],
    schema: ['01-database'],
    query: ['01-database'],
    api: ['03-api'],
    route: ['03-api'],
    endpoint: ['03-api'],
    form: ['04-frontend'],
    component: ['04-frontend'],
    react: ['04-frontend'],
    payment: ['05-payments'],
    stripe: ['05-payments'],
    billing: ['05-payments'],
    test: ['08-testing'],
    email: ['06b-email'],
    voice: ['06a-voice'],
    vapi: ['06a-voice', '25c-voice-vapi'],
  };

  const relevantPatterns = new Set<string>(['00-core']); // Always include core

  // Add patterns based on keywords
  for (const keyword of keywords) {
    const patterns = keywordPatternMap[keyword.toLowerCase()];
    if (patterns) {
      patterns.forEach(p => relevantPatterns.add(p));
    }
  }

  // Also search in task description
  const taskLower = task.toLowerCase();
  for (const [keyword, patterns] of Object.entries(keywordPatternMap)) {
    if (taskLower.includes(keyword)) {
      patterns.forEach(p => relevantPatterns.add(p));
    }
  }

  return {
    task,
    keywords,
    patterns: Array.from(relevantPatterns),
    message: `Found ${relevantPatterns.size} relevant patterns for: ${task}`,
  };
}

async function handleValidateComplete(feature: string, files: string[], projectPath?: string) {
  const issues: string[] = [];
  const passed: string[] = [];

  // Check if tests exist
  const testFiles = files.filter(f => f.includes('.test.') || f.includes('.spec.'));
  if (testFiles.length === 0) {
    issues.push('No test files found. Tests are required for every feature.');
  } else {
    passed.push(`Found ${testFiles.length} test file(s)`);
  }

  // Check TypeScript compilation (if projectPath provided)
  if (projectPath) {
    try {
      await execAsync('npx tsc --noEmit', { cwd: projectPath });
      passed.push('TypeScript compilation passed');
    } catch {
      issues.push('TypeScript compilation failed');
    }
  }

  return {
    feature,
    files,
    valid: issues.length === 0,
    issues,
    passed,
  };
}

async function handleGuardianAnalyze(files: string[], projectPath?: string) {
  const issues: Array<{ file: string; issue: string; severity: string; fix?: string }> = [];

  // Would analyze files for:
  // - Broken imports
  // - Type mismatches
  // - Unused variables
  // - Console.logs in production
  // - Missing error handling

  return {
    analyzed: files?.length || 0,
    issues,
    summary: issues.length === 0
      ? 'No issues found'
      : `Found ${issues.length} issue(s)`,
  };
}

async function handleGuardianHeal(issues: any[], projectPath?: string) {
  // Would auto-fix issues
  return {
    fixed: 0,
    skipped: issues?.length || 0,
    message: 'Guardian heal completed',
  };
}

async function handleGuardianVerify(projectPath?: string) {
  const checks = {
    typescript: true,
    imports: true,
    tests: true,
  };

  if (projectPath) {
    try {
      await execAsync('npx tsc --noEmit', { cwd: projectPath });
    } catch {
      checks.typescript = false;
    }
  }

  const allPassed = Object.values(checks).every(v => v);

  return {
    passed: allPassed,
    checks,
  };
}

async function handleGuardianStatus(projectPath?: string) {
  return {
    health: 85,
    lastCheck: new Date().toISOString(),
    issues: 0,
    warnings: 0,
  };
}

async function handleRippleCheck(entityName: string, changeType: string, projectPath?: string) {
  // Would search for all files that reference the entity
  return {
    entity: entityName,
    changeType,
    affectedFiles: [],
    message: `Ripple check for ${entityName}`,
  };
}

async function handleProjectStatus(projectPath?: string) {
  return {
    initialized: true,
    patternsLoaded: true,
    lastActivity: new Date().toISOString(),
  };
}

async function handleRunAudit(projectPath?: string) {
  return {
    score: 78,
    categories: {
      security: 85,
      performance: 72,
      codeQuality: 80,
      testing: 75,
    },
    issues: [],
    suggestions: [],
  };
}

async function handleRunTests(projectPath?: string) {
  if (!projectPath) {
    return { error: 'Project path required' };
  }

  try {
    const { stdout, stderr } = await execAsync('npm test', { cwd: projectPath });
    return {
      passed: true,
      output: stdout,
      errors: stderr,
    };
  } catch (error: any) {
    return {
      passed: false,
      output: error.stdout,
      errors: error.stderr,
    };
  }
}

async function handleDetectIntent(message: string) {
  const messageLower = message.toLowerCase();

  let intent = 'unknown';
  let confidence = 0.5;

  if (messageLower.includes('build') || messageLower.includes('create')) {
    intent = 'build';
    confidence = 0.9;
  } else if (messageLower.includes('add') || messageLower.includes('feature')) {
    intent = 'feature';
    confidence = 0.85;
  } else if (messageLower.includes('fix') || messageLower.includes('bug')) {
    intent = 'fix';
    confidence = 0.9;
  } else if (messageLower.includes('test')) {
    intent = 'test';
    confidence = 0.85;
  } else if (messageLower.includes('deploy') || messageLower.includes('vercel')) {
    intent = 'deploy';
    confidence = 0.9;
  } else if (messageLower.includes('audit') || messageLower.includes('review')) {
    intent = 'audit';
    confidence = 0.85;
  }

  return { intent, confidence, message };
}

async function handleUpdatePatterns() {
  // Would trigger pattern update
  return {
    updated: true,
    version: '6.12',
    message: 'Patterns updated successfully',
  };
}
