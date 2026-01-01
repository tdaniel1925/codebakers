import { db } from '@/db';
import {
  enforcementSessions,
  patternDiscoveries,
  patternValidations,
  NewEnforcementSession,
  EnforcementSession,
} from '@/db/schema';
import { eq, and, gt, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { ContentService } from './content-service';

// Session expiry: 2 hours
const SESSION_EXPIRY_MS = 2 * 60 * 60 * 1000;

// Keyword to pattern mapping
const KEYWORD_PATTERN_MAP: Record<string, string[]> = {
  // Auth keywords
  auth: ['02-auth.md'],
  login: ['02-auth.md'],
  signup: ['02-auth.md'],
  password: ['02-auth.md'],
  session: ['02-auth.md'],
  oauth: ['02-auth.md'],
  jwt: ['02-auth.md'],

  // Database keywords
  database: ['01-database.md'],
  drizzle: ['01-database.md'],
  postgres: ['01-database.md'],
  sql: ['01-database.md'],
  schema: ['01-database.md'],
  migration: ['01-database.md'],
  query: ['01-database.md'],

  // API keywords
  api: ['03-api.md'],
  route: ['03-api.md'],
  endpoint: ['03-api.md'],
  rest: ['03-api.md'],
  validation: ['03-api.md'],

  // Frontend keywords
  react: ['04-frontend.md'],
  component: ['04-frontend.md'],
  form: ['04-frontend.md'],
  state: ['04-frontend.md'],
  hook: ['04-frontend.md'],

  // Payment keywords
  payment: ['05-payments.md'],
  stripe: ['05-payments.md'],
  subscription: ['05-payments.md'],
  billing: ['05-payments.md'],
  checkout: ['05-payments.md'],

  // Voice/VAPI keywords
  voice: ['06a-voice.md', '25c-voice-vapi.md'],
  vapi: ['06a-voice.md', '25c-voice-vapi.md'],
  call: ['06a-voice.md'],
  phone: ['06a-voice.md'],

  // Email keywords
  email: ['06b-email.md', '28-email-design.md'],
  resend: ['06b-email.md'],
  nylas: ['06b-email.md'],
  smtp: ['06b-email.md'],

  // Testing keywords
  test: ['08-testing.md'],
  playwright: ['08-testing.md'],
  vitest: ['08-testing.md'],

  // Design keywords
  ui: ['09-design.md'],
  design: ['09-design.md'],
  dashboard: ['09-design.md'],
  layout: ['09a-layouts.md'],
  accessibility: ['09b-accessibility.md'],
  seo: ['09c-seo.md'],

  // AI keywords
  ai: ['14-ai.md'],
  openai: ['14-ai.md'],
  anthropic: ['14-ai.md'],
  llm: ['14-ai.md'],
  embedding: ['14-ai.md'],
};

export interface DiscoverPatternsInput {
  task: string;
  files?: string[];
  keywords?: string[];
  projectHash?: string;
  projectName?: string;
}

export interface DiscoverPatternsResult {
  sessionToken: string;
  sessionId: string; // v6.1: Include session ID for conflict tracking
  expiresAt: Date; // v6.1: Include expiry for client display
  patterns: Array<{
    name: string;
    relevance: 'high' | 'medium' | 'low';
    content: string;
  }>;
  coreRules: string; // Always include core rules
  message: string;
}

export interface ValidateCompleteInput {
  sessionToken: string;
  featureName: string;
  featureDescription?: string;
  filesModified?: string[];
  testsWritten?: string[];
  testsRun?: boolean;
  testsPassed?: boolean;
  typescriptPassed?: boolean;
}

export interface ValidateCompleteResult {
  passed: boolean;
  issues: Array<{
    type: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
  sessionCompleted: boolean;
  message: string;
}

export class EnforcementService {
  /**
   * START GATE: discover_patterns
   * Creates a new enforcement session and returns relevant patterns
   */
  static async discoverPatterns(
    input: DiscoverPatternsInput,
    auth: { teamId?: string; apiKeyId?: string; deviceHash?: string }
  ): Promise<DiscoverPatternsResult> {
    const startTime = Date.now();

    // Extract keywords from task if not provided
    const keywords = input.keywords || this.extractKeywords(input.task);

    // Find relevant patterns based on keywords
    const patternNames = this.findPatternsByKeywords(keywords);

    // Always include 00-core
    if (!patternNames.includes('00-core.md')) {
      patternNames.unshift('00-core.md');
    }

    // Get content from database
    const content = await ContentService.getEncodedContent();
    const modules = content.modules || {};

    // Build patterns array with content
    const patterns: DiscoverPatternsResult['patterns'] = [];
    for (const name of patternNames) {
      if (modules[name]) {
        patterns.push({
          name,
          relevance: name === '00-core.md' ? 'high' : 'medium',
          content: modules[name],
        });
      }
    }

    // Generate session token
    const sessionToken = `ses_${randomUUID().replace(/-/g, '')}`;

    // Create enforcement session
    const sessionData: NewEnforcementSession = {
      teamId: auth.teamId || null,
      apiKeyId: auth.apiKeyId || null,
      deviceHash: auth.deviceHash || null,
      sessionToken,
      projectHash: input.projectHash || null,
      projectName: input.projectName || null,
      task: input.task,
      plannedFiles: input.files ? JSON.stringify(input.files) : null,
      keywords: JSON.stringify(keywords),
      startGatePassed: true,
      patternsReturned: JSON.stringify(patternNames),
      codeExamplesReturned: patterns.length,
      expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS),
    };

    const [session] = await db.insert(enforcementSessions).values(sessionData).returning();

    // Log discovery
    await db.insert(patternDiscoveries).values({
      sessionId: session.id,
      task: input.task,
      keywords: JSON.stringify(keywords),
      patternsMatched: JSON.stringify(patternNames.map((name) => ({ pattern: name, relevance: 'medium' }))),
      responseTimeMs: Date.now() - startTime,
    });

    return {
      sessionToken,
      sessionId: session.id,
      expiresAt: sessionData.expiresAt,
      patterns,
      coreRules: modules['00-core.md'] || '',
      message: `Found ${patterns.length} relevant patterns. You MUST follow these patterns when implementing "${input.task}". Your session token is ${sessionToken} - use this when calling validate_complete.`,
    };
  }

  /**
   * END GATE: validate_complete
   * Validates that the AI followed patterns and tests pass
   */
  static async validateComplete(input: ValidateCompleteInput): Promise<ValidateCompleteResult> {
    const startTime = Date.now();
    const issues: ValidateCompleteResult['issues'] = [];

    // Find the session
    const session = await db.query.enforcementSessions.findFirst({
      where: eq(enforcementSessions.sessionToken, input.sessionToken),
    });

    if (!session) {
      return {
        passed: false,
        issues: [
          {
            type: 'SESSION_NOT_FOUND',
            message:
              'No active session found with this token. You must call discover_patterns BEFORE writing code to get a session token.',
            severity: 'error',
          },
        ],
        sessionCompleted: false,
        message: 'VALIDATION FAILED: No session found. You did not call discover_patterns first.',
      };
    }

    // Check if session expired
    if (new Date(session.expiresAt) < new Date()) {
      await db
        .update(enforcementSessions)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(eq(enforcementSessions.id, session.id));

      return {
        passed: false,
        issues: [
          {
            type: 'SESSION_EXPIRED',
            message: 'Session has expired. Call discover_patterns again to start a new session.',
            severity: 'error',
          },
        ],
        sessionCompleted: false,
        message: 'VALIDATION FAILED: Session expired. Start a new session with discover_patterns.',
      };
    }

    // Check if session already completed
    if (session.status === 'completed') {
      return {
        passed: true,
        issues: [],
        sessionCompleted: true,
        message: 'This session was already validated successfully.',
      };
    }

    // Verify START gate was passed
    if (!session.startGatePassed) {
      issues.push({
        type: 'START_GATE_NOT_PASSED',
        message: 'discover_patterns was not properly called before writing code.',
        severity: 'error',
      });
    }

    // Check if tests were run
    if (!input.testsRun) {
      issues.push({
        type: 'TESTS_NOT_RUN',
        message: 'Tests must be run before completing a feature. Run npm test.',
        severity: 'error',
      });
    }

    // Check if tests passed
    if (input.testsRun && !input.testsPassed) {
      issues.push({
        type: 'TESTS_FAILED',
        message: 'Tests are failing. Fix all test failures before completing.',
        severity: 'error',
      });
    }

    // Check if TypeScript compiled
    if (input.typescriptPassed === false) {
      issues.push({
        type: 'TYPESCRIPT_ERROR',
        message: 'TypeScript has compilation errors. Run npx tsc --noEmit to see errors.',
        severity: 'error',
      });
    }

    // Check if tests were written (warning only)
    if (!input.testsWritten || input.testsWritten.length === 0) {
      issues.push({
        type: 'NO_TESTS_WRITTEN',
        message: 'No test files were specified. Features should include tests.',
        severity: 'warning',
      });
    }

    // Determine if validation passed (errors = fail, warnings = pass with warnings)
    const hasErrors = issues.some((i) => i.severity === 'error');
    const passed = !hasErrors;

    // Update session
    const newStatus = passed ? 'completed' : 'failed';
    await db
      .update(enforcementSessions)
      .set({
        endGatePassed: passed,
        endGateAt: new Date(),
        validationPassed: passed,
        validationIssues: JSON.stringify(issues),
        testsRun: input.testsRun || false,
        testsPassed: input.testsPassed || false,
        typescriptPassed: input.typescriptPassed ?? null,
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(enforcementSessions.id, session.id));

    // Log validation
    await db.insert(patternValidations).values({
      sessionId: session.id,
      featureName: input.featureName,
      featureDescription: input.featureDescription || null,
      filesModified: input.filesModified ? JSON.stringify(input.filesModified) : null,
      testsWritten: input.testsWritten ? JSON.stringify(input.testsWritten) : null,
      passed,
      issues: JSON.stringify(issues),
      startGateVerified: session.startGatePassed,
      testsExist: (input.testsWritten?.length || 0) > 0,
      testsPass: input.testsPassed || false,
      typescriptCompiles: input.typescriptPassed ?? null,
      responseTimeMs: Date.now() - startTime,
    });

    return {
      passed,
      issues,
      sessionCompleted: passed,
      message: passed
        ? `✅ VALIDATION PASSED: Feature "${input.featureName}" completed successfully.`
        : `❌ VALIDATION FAILED: Fix the following issues:\n${issues.map((i) => `- [${i.severity.toUpperCase()}] ${i.message}`).join('\n')}`,
    };
  }

  /**
   * Get patterns by name (for /api/patterns/get endpoint)
   */
  static async getPatterns(
    patternNames: string[]
  ): Promise<Array<{ name: string; content: string; found: boolean }>> {
    const content = await ContentService.getEncodedContent();
    const modules = content.modules || {};

    return patternNames.map((name) => ({
      name,
      content: modules[name] || '',
      found: !!modules[name],
    }));
  }

  /**
   * Get active session for a team/device
   */
  static async getActiveSession(auth: {
    teamId?: string;
    deviceHash?: string;
  }): Promise<EnforcementSession | null> {
    const conditions = [];

    if (auth.teamId) {
      conditions.push(eq(enforcementSessions.teamId, auth.teamId));
    }
    if (auth.deviceHash) {
      conditions.push(eq(enforcementSessions.deviceHash, auth.deviceHash));
    }

    if (conditions.length === 0) return null;

    const session = await db.query.enforcementSessions.findFirst({
      where: and(...conditions, eq(enforcementSessions.status, 'active'), gt(enforcementSessions.expiresAt, new Date())),
      orderBy: [desc(enforcementSessions.createdAt)],
    });

    return session || null;
  }

  /**
   * Get session by token
   */
  static async getSessionByToken(token: string): Promise<EnforcementSession | null> {
    const session = await db.query.enforcementSessions.findFirst({
      where: eq(enforcementSessions.sessionToken, token),
    });

    return session || null;
  }

  /**
   * Extract keywords from a task description
   */
  private static extractKeywords(task: string): string[] {
    const lowercaseTask = task.toLowerCase();
    const keywords: string[] = [];

    // Check for all known keywords
    for (const keyword of Object.keys(KEYWORD_PATTERN_MAP)) {
      if (lowercaseTask.includes(keyword)) {
        keywords.push(keyword);
      }
    }

    // If no keywords found, try some generic ones based on common words
    if (keywords.length === 0) {
      if (lowercaseTask.includes('add') || lowercaseTask.includes('create') || lowercaseTask.includes('build')) {
        keywords.push('component', 'api'); // General patterns
      }
    }

    return keywords;
  }

  /**
   * Find patterns based on keywords
   */
  private static findPatternsByKeywords(keywords: string[]): string[] {
    const patternSet = new Set<string>();

    for (const keyword of keywords) {
      const patterns = KEYWORD_PATTERN_MAP[keyword.toLowerCase()];
      if (patterns) {
        for (const pattern of patterns) {
          patternSet.add(pattern);
        }
      }
    }

    // If no patterns found, include some defaults
    if (patternSet.size === 0) {
      patternSet.add('04-frontend.md');
      patternSet.add('03-api.md');
    }

    return Array.from(patternSet);
  }
}
