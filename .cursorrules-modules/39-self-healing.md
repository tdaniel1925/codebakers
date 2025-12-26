# Self-Healing System

> Load this module when: Implementing error recovery, auto-fix systems, production monitoring, development error handling

---

## Overview

The self-healing system automatically detects, classifies, and fixes errors in both development and production environments. It uses AI analysis to suggest or apply fixes based on error patterns and confidence scoring.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SELF-HEALING SYSTEM                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   DETECT     │───▶│   CLASSIFY   │───▶│   ANALYZE    │      │
│  │              │    │              │    │              │      │
│  │ • File watch │    │ • Error type │    │ • Root cause │      │
│  │ • Build logs │    │ • Severity   │    │ • Context    │      │
│  │ • Runtime    │    │ • Category   │    │ • Patterns   │      │
│  │ • Sentry     │    │ • Priority   │    │ • History    │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                │                │
│                                                ▼                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   VERIFY     │◀───│    FIX       │◀───│   DECIDE     │      │
│  │              │    │              │    │              │      │
│  │ • Tests pass │    │ • Auto-fix   │    │ • Confidence │      │
│  │ • Build OK   │    │ • Suggest    │    │ • Risk level │      │
│  │ • No regress │    │ • PR create  │    │ • Auto/Manual│      │
│  │ • Rollback?  │    │ • Rollback   │    │ • Approval   │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Error Classification System

### Error Types

```typescript
// src/lib/healing/types.ts

export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type ErrorCategory =
  | 'typescript'      // Type errors, missing types
  | 'runtime'         // Runtime exceptions
  | 'build'           // Build failures
  | 'dependency'      // Package issues
  | 'database'        // DB connection, query errors
  | 'auth'            // Authentication failures
  | 'api'             // API errors, validation
  | 'performance'     // Slow queries, memory leaks
  | 'security'        // Vulnerabilities detected
  | 'configuration'   // Missing env vars, bad config
  | 'network'         // Connection issues
  | 'unknown';        // Unclassified

export interface ClassifiedError {
  id: string;
  timestamp: Date;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  stack?: string;
  file?: string;
  line?: number;
  column?: number;
  context: ErrorContext;
  suggestedFixes: SuggestedFix[];
  autoFixable: boolean;
  confidence: number; // 0-100
}

export interface ErrorContext {
  environment: 'development' | 'production' | 'test';
  recentChanges?: string[];
  relatedFiles?: string[];
  previousOccurrences?: number;
  userImpact?: 'none' | 'degraded' | 'blocked';
}

export interface SuggestedFix {
  id: string;
  description: string;
  code?: string;
  file?: string;
  confidence: number;
  risk: 'safe' | 'moderate' | 'risky';
  requiresReview: boolean;
}
```

### Classification Rules

```typescript
// src/lib/healing/classifier.ts

const ERROR_PATTERNS: Record<string, ClassificationRule> = {
  // TypeScript Errors
  'TS2307': {
    category: 'typescript',
    severity: 'high',
    pattern: /Cannot find module '(.+)'/,
    autoFixable: true,
    confidence: 95,
    fix: 'install_missing_module'
  },
  'TS2322': {
    category: 'typescript',
    severity: 'medium',
    pattern: /Type '(.+)' is not assignable to type '(.+)'/,
    autoFixable: false,
    confidence: 70,
    fix: 'suggest_type_fix'
  },
  'TS2339': {
    category: 'typescript',
    severity: 'medium',
    pattern: /Property '(.+)' does not exist on type '(.+)'/,
    autoFixable: true,
    confidence: 85,
    fix: 'add_missing_property'
  },

  // Runtime Errors
  'TypeError': {
    category: 'runtime',
    severity: 'high',
    pattern: /Cannot read propert(y|ies) of (undefined|null)/,
    autoFixable: true,
    confidence: 80,
    fix: 'add_null_check'
  },
  'ReferenceError': {
    category: 'runtime',
    severity: 'high',
    pattern: /(.+) is not defined/,
    autoFixable: true,
    confidence: 75,
    fix: 'add_import_or_declaration'
  },

  // Database Errors
  'ECONNREFUSED': {
    category: 'database',
    severity: 'critical',
    pattern: /connect ECONNREFUSED/,
    autoFixable: false,
    confidence: 95,
    fix: 'check_database_connection'
  },
  'relation_not_exist': {
    category: 'database',
    severity: 'high',
    pattern: /relation "(.+)" does not exist/,
    autoFixable: true,
    confidence: 90,
    fix: 'run_migrations'
  },

  // Auth Errors
  'AUTH_SECRET': {
    category: 'auth',
    severity: 'critical',
    pattern: /AUTH_SECRET.*missing|undefined/i,
    autoFixable: true,
    confidence: 95,
    fix: 'generate_auth_secret'
  },

  // Configuration Errors
  'ENV_MISSING': {
    category: 'configuration',
    severity: 'high',
    pattern: /Missing required environment variable: (.+)/,
    autoFixable: false,
    confidence: 95,
    fix: 'prompt_env_value'
  },

  // Build Errors
  'MODULE_NOT_FOUND': {
    category: 'dependency',
    severity: 'high',
    pattern: /Module not found: Can't resolve '(.+)'/,
    autoFixable: true,
    confidence: 90,
    fix: 'install_package'
  },

  // Security Issues
  'VULNERABLE_PACKAGE': {
    category: 'security',
    severity: 'high',
    pattern: /found \d+ vulnerabilit(y|ies)/i,
    autoFixable: true,
    confidence: 85,
    fix: 'npm_audit_fix'
  }
};

export function classifyError(error: Error | string): ClassifiedError {
  const errorStr = typeof error === 'string' ? error : error.message;
  const stack = typeof error === 'object' ? error.stack : undefined;

  for (const [code, rule] of Object.entries(ERROR_PATTERNS)) {
    const match = errorStr.match(rule.pattern);
    if (match) {
      return {
        id: generateErrorId(),
        timestamp: new Date(),
        category: rule.category,
        severity: rule.severity,
        message: errorStr,
        stack,
        autoFixable: rule.autoFixable,
        confidence: rule.confidence,
        context: extractContext(error),
        suggestedFixes: generateFixes(rule.fix, match)
      };
    }
  }

  // Unknown error
  return {
    id: generateErrorId(),
    timestamp: new Date(),
    category: 'unknown',
    severity: 'medium',
    message: errorStr,
    stack,
    autoFixable: false,
    confidence: 0,
    context: extractContext(error),
    suggestedFixes: []
  };
}
```

---

## Development Mode Healing

### File Watcher Integration

```typescript
// src/lib/healing/dev-watcher.ts

import chokidar from 'chokidar';
import { classifyError } from './classifier';
import { applyFix } from './fixer';

export class DevWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private errorBuffer: ClassifiedError[] = [];
  private isHealing = false;

  start(projectPath: string) {
    console.log('🔍 Self-healing watcher started');

    // Watch for file changes
    this.watcher = chokidar.watch([
      `${projectPath}/src/**/*.{ts,tsx}`,
      `${projectPath}/.next/server/app-build-manifest.json`
    ], {
      ignored: /node_modules/,
      persistent: true
    });

    // Watch build output for errors
    this.watchBuildProcess();

    // Watch console for runtime errors
    this.interceptConsole();
  }

  private watchBuildProcess() {
    // Hook into Next.js build events
    process.on('uncaughtException', async (error) => {
      await this.handleError(error);
    });

    process.on('unhandledRejection', async (reason) => {
      if (reason instanceof Error) {
        await this.handleError(reason);
      }
    });
  }

  private async handleError(error: Error) {
    if (this.isHealing) return; // Prevent loops

    const classified = classifyError(error);
    this.errorBuffer.push(classified);

    console.log(`\n🔴 Error detected: ${classified.category}`);
    console.log(`   Severity: ${classified.severity}`);
    console.log(`   Message: ${classified.message}`);

    if (classified.autoFixable && classified.confidence >= 80) {
      console.log(`\n🔧 Auto-fix available (${classified.confidence}% confidence)`);

      if (await this.shouldAutoFix(classified)) {
        await this.attemptAutoFix(classified);
      } else {
        console.log('💡 Suggested fixes:');
        classified.suggestedFixes.forEach((fix, i) => {
          console.log(`   ${i + 1}. ${fix.description}`);
        });
      }
    }
  }

  private async shouldAutoFix(error: ClassifiedError): Promise<boolean> {
    // Auto-fix only safe fixes with high confidence
    return (
      error.confidence >= 90 &&
      error.suggestedFixes.some(f => f.risk === 'safe') &&
      error.severity !== 'critical'
    );
  }

  private async attemptAutoFix(error: ClassifiedError) {
    this.isHealing = true;

    const safeFix = error.suggestedFixes.find(f => f.risk === 'safe');
    if (!safeFix) {
      this.isHealing = false;
      return;
    }

    console.log(`\n🔧 Applying fix: ${safeFix.description}`);

    try {
      const result = await applyFix(safeFix, error);

      if (result.success) {
        console.log('✅ Fix applied successfully');

        // Verify the fix
        const verified = await this.verifyFix(error);
        if (verified) {
          console.log('✅ Fix verified - error resolved');
        } else {
          console.log('⚠️  Fix applied but error persists - reverting');
          await this.revertFix(result);
        }
      }
    } catch (fixError) {
      console.error('❌ Fix failed:', fixError);
    }

    this.isHealing = false;
  }

  private async verifyFix(error: ClassifiedError): Promise<boolean> {
    // Re-run build/type check to verify
    const { execSync } = await import('child_process');

    try {
      execSync('npx tsc --noEmit', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  stop() {
    this.watcher?.close();
    console.log('🔍 Self-healing watcher stopped');
  }
}
```

### Auto-Fix Implementations

```typescript
// src/lib/healing/fixer.ts

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

interface FixResult {
  success: boolean;
  changes: FileChange[];
  revertData?: any;
}

interface FileChange {
  file: string;
  before: string;
  after: string;
}

export async function applyFix(
  fix: SuggestedFix,
  error: ClassifiedError
): Promise<FixResult> {
  switch (fix.id) {
    case 'install_missing_module':
      return installMissingModule(error);

    case 'add_null_check':
      return addNullCheck(error);

    case 'run_migrations':
      return runMigrations();

    case 'generate_auth_secret':
      return generateAuthSecret();

    case 'install_package':
      return installPackage(error);

    case 'npm_audit_fix':
      return npmAuditFix();

    case 'add_missing_property':
      return addMissingProperty(error);

    default:
      return { success: false, changes: [] };
  }
}

async function installMissingModule(error: ClassifiedError): Promise<FixResult> {
  const match = error.message.match(/Cannot find module '(.+)'/);
  if (!match) return { success: false, changes: [] };

  const moduleName = match[1];

  // Check if it's a relative import vs npm package
  if (moduleName.startsWith('.') || moduleName.startsWith('@/')) {
    // Relative import - suggest creating the file
    return { success: false, changes: [] };
  }

  // Extract package name (handle scoped packages)
  const packageName = moduleName.startsWith('@')
    ? moduleName.split('/').slice(0, 2).join('/')
    : moduleName.split('/')[0];

  try {
    execSync(`npm install ${packageName}`, { stdio: 'pipe' });
    return {
      success: true,
      changes: [],
      revertData: { packageName }
    };
  } catch {
    return { success: false, changes: [] };
  }
}

async function addNullCheck(error: ClassifiedError): Promise<FixResult> {
  if (!error.file || !error.line) {
    return { success: false, changes: [] };
  }

  const content = await fs.readFile(error.file, 'utf-8');
  const lines = content.split('\n');
  const line = lines[error.line - 1];

  // Find the property access pattern
  const match = line.match(/(\w+)\.(\w+)/);
  if (!match) return { success: false, changes: [] };

  const [, obj, prop] = match;
  const newLine = line.replace(
    `${obj}.${prop}`,
    `${obj}?.${prop}`
  );

  lines[error.line - 1] = newLine;
  const newContent = lines.join('\n');

  await fs.writeFile(error.file, newContent);

  return {
    success: true,
    changes: [{
      file: error.file,
      before: content,
      after: newContent
    }]
  };
}

async function runMigrations(): Promise<FixResult> {
  try {
    execSync('npx drizzle-kit push', { stdio: 'pipe' });
    return { success: true, changes: [] };
  } catch {
    return { success: false, changes: [] };
  }
}

async function generateAuthSecret(): Promise<FixResult> {
  const crypto = await import('crypto');
  const secret = crypto.randomBytes(32).toString('base64');

  const envPath = '.env.local';
  let content = '';

  try {
    content = await fs.readFile(envPath, 'utf-8');
  } catch {
    // File doesn't exist
  }

  if (content.includes('AUTH_SECRET=')) {
    // Replace existing
    content = content.replace(/AUTH_SECRET=.*/, `AUTH_SECRET=${secret}`);
  } else {
    // Add new
    content += `\nAUTH_SECRET=${secret}\n`;
  }

  await fs.writeFile(envPath, content);

  return {
    success: true,
    changes: [{
      file: envPath,
      before: '',
      after: `AUTH_SECRET=${secret}`
    }]
  };
}

async function installPackage(error: ClassifiedError): Promise<FixResult> {
  const match = error.message.match(/Can't resolve '(.+)'/);
  if (!match) return { success: false, changes: [] };

  const packageName = match[1].split('/')[0];

  try {
    execSync(`npm install ${packageName}`, { stdio: 'pipe' });
    return { success: true, changes: [] };
  } catch {
    return { success: false, changes: [] };
  }
}

async function npmAuditFix(): Promise<FixResult> {
  try {
    execSync('npm audit fix', { stdio: 'pipe' });
    return { success: true, changes: [] };
  } catch {
    return { success: false, changes: [] };
  }
}

async function addMissingProperty(error: ClassifiedError): Promise<FixResult> {
  // This would need AI assistance to determine the correct type
  // For now, return as non-auto-fixable
  return { success: false, changes: [] };
}
```

---

## Production Mode Healing

### Sentry Integration

```typescript
// src/lib/healing/production-monitor.ts

import * as Sentry from '@sentry/nextjs';
import { classifyError } from './classifier';

export function initProductionHealing() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,

    beforeSend(event, hint) {
      const error = hint.originalException;

      if (error instanceof Error) {
        const classified = classifyError(error);

        // Add classification to Sentry
        event.tags = {
          ...event.tags,
          error_category: classified.category,
          error_severity: classified.severity,
          auto_fixable: String(classified.autoFixable)
        };

        event.extra = {
          ...event.extra,
          suggested_fixes: classified.suggestedFixes,
          confidence: classified.confidence
        };

        // Handle critical errors
        if (classified.severity === 'critical') {
          triggerCriticalErrorWorkflow(classified, event);
        }
      }

      return event;
    }
  });
}

async function triggerCriticalErrorWorkflow(
  error: ClassifiedError,
  sentryEvent: Sentry.Event
) {
  // 1. Alert on-call team
  await sendAlert({
    severity: 'critical',
    message: error.message,
    sentryLink: `https://sentry.io/issues/${sentryEvent.event_id}`
  });

  // 2. Check if rollback is needed
  if (shouldRollback(error)) {
    await triggerRollback();
  }

  // 3. Create incident ticket
  await createIncidentTicket(error, sentryEvent);
}

function shouldRollback(error: ClassifiedError): boolean {
  const rollbackCategories: ErrorCategory[] = ['database', 'auth', 'security'];
  const rollbackSeverities: ErrorSeverity[] = ['critical'];

  return (
    rollbackCategories.includes(error.category) &&
    rollbackSeverities.includes(error.severity) &&
    error.context.userImpact === 'blocked'
  );
}

async function triggerRollback() {
  // Trigger Vercel rollback via API
  const response = await fetch(
    `https://api.vercel.com/v6/deployments/${process.env.VERCEL_DEPLOYMENT_ID}/rollback`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.VERCEL_TOKEN}`
      }
    }
  );

  if (response.ok) {
    console.log('🔄 Rollback triggered successfully');
    await sendAlert({
      severity: 'info',
      message: 'Automatic rollback triggered due to critical error'
    });
  }
}
```

### Automated PR Creation

```typescript
// src/lib/healing/auto-pr.ts

import { Octokit } from '@octokit/rest';
import { classifyError, SuggestedFix } from './classifier';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export async function createFixPR(
  error: ClassifiedError,
  fix: SuggestedFix
): Promise<string | null> {
  const owner = process.env.GITHUB_OWNER!;
  const repo = process.env.GITHUB_REPO!;
  const baseBranch = 'main';
  const fixBranch = `auto-fix/${error.id}`;

  try {
    // 1. Get base branch ref
    const { data: ref } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${baseBranch}`
    });

    // 2. Create fix branch
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${fixBranch}`,
      sha: ref.object.sha
    });

    // 3. Apply fix (commit changes)
    if (fix.file && fix.code) {
      const { data: file } = await octokit.repos.getContent({
        owner,
        repo,
        path: fix.file,
        ref: baseBranch
      });

      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: fix.file,
        message: `fix: ${fix.description}`,
        content: Buffer.from(fix.code).toString('base64'),
        sha: (file as any).sha,
        branch: fixBranch
      });
    }

    // 4. Create PR
    const { data: pr } = await octokit.pulls.create({
      owner,
      repo,
      title: `[Auto-Fix] ${error.category}: ${fix.description}`,
      head: fixBranch,
      base: baseBranch,
      body: `
## Automated Fix

This PR was automatically generated by the self-healing system.

### Error Details
- **Category:** ${error.category}
- **Severity:** ${error.severity}
- **Message:** ${error.message}
- **Confidence:** ${fix.confidence}%

### Fix Applied
${fix.description}

### Verification
- [ ] Tests pass
- [ ] Build succeeds
- [ ] No regressions

---
🤖 Generated by CodeBakers Self-Healing System
      `
    });

    // 5. Add labels
    await octokit.issues.addLabels({
      owner,
      repo,
      issue_number: pr.number,
      labels: ['auto-fix', error.severity, error.category]
    });

    return pr.html_url;
  } catch (error) {
    console.error('Failed to create fix PR:', error);
    return null;
  }
}
```

---

## CLI Integration

### /heal Command

```typescript
// cli/src/commands/heal.ts

import chalk from 'chalk';
import ora from 'ora';
import { classifyError, ClassifiedError } from '../lib/classifier.js';
import { applyFix } from '../lib/fixer.js';

interface HealOptions {
  auto?: boolean;       // Auto-fix without prompting
  watch?: boolean;      // Watch mode
  severity?: string;    // Filter by severity
  dryRun?: boolean;     // Show fixes without applying
}

export async function heal(options: HealOptions = {}) {
  console.log(chalk.blue('\n🏥 CodeBakers Self-Healing\n'));

  if (options.watch) {
    return startWatchMode();
  }

  // Run diagnostics
  const spinner = ora('Scanning for issues...').start();
  const errors = await scanForErrors();
  spinner.stop();

  if (errors.length === 0) {
    console.log(chalk.green('✅ No issues found!'));
    return;
  }

  console.log(chalk.yellow(`Found ${errors.length} issue(s):\n`));

  // Display and handle each error
  for (const error of errors) {
    displayError(error);

    if (error.autoFixable) {
      if (options.dryRun) {
        console.log(chalk.gray('   [Dry run - fix would be applied]'));
      } else if (options.auto || await confirmFix(error)) {
        await attemptFix(error);
      }
    }

    console.log('');
  }

  // Summary
  const fixed = errors.filter(e => e.fixed).length;
  const remaining = errors.length - fixed;

  console.log(chalk.blue('\n📊 Summary'));
  console.log(`   Fixed: ${chalk.green(fixed)}`);
  console.log(`   Remaining: ${remaining > 0 ? chalk.yellow(remaining) : chalk.green(0)}`);
}

async function scanForErrors(): Promise<ClassifiedError[]> {
  const errors: ClassifiedError[] = [];

  // 1. TypeScript errors
  try {
    const { execSync } = await import('child_process');
    execSync('npx tsc --noEmit 2>&1', { encoding: 'utf-8' });
  } catch (error: any) {
    const output = error.stdout || error.message;
    const tsErrors = parseTypeScriptErrors(output);
    errors.push(...tsErrors);
  }

  // 2. Build errors
  try {
    const { execSync } = await import('child_process');
    execSync('npm run build 2>&1', { encoding: 'utf-8' });
  } catch (error: any) {
    const buildErrors = parseBuildErrors(error.stdout || error.message);
    errors.push(...buildErrors);
  }

  // 3. Environment issues
  const envErrors = await checkEnvironment();
  errors.push(...envErrors);

  // 4. Security vulnerabilities
  const securityErrors = await checkSecurity();
  errors.push(...securityErrors);

  return errors;
}

function displayError(error: ClassifiedError) {
  const severityColors = {
    critical: chalk.red,
    high: chalk.red,
    medium: chalk.yellow,
    low: chalk.blue,
    info: chalk.gray
  };

  const color = severityColors[error.severity];

  console.log(`${color('●')} ${chalk.bold(error.category.toUpperCase())}`);
  console.log(`   ${error.message}`);

  if (error.file) {
    console.log(chalk.gray(`   ${error.file}:${error.line || ''}`));
  }

  if (error.autoFixable) {
    console.log(chalk.green(`   ✓ Auto-fixable (${error.confidence}% confidence)`));
    error.suggestedFixes.forEach(fix => {
      console.log(chalk.cyan(`     → ${fix.description}`));
    });
  } else if (error.suggestedFixes.length > 0) {
    console.log(chalk.yellow('   Manual fixes suggested:'));
    error.suggestedFixes.forEach(fix => {
      console.log(chalk.cyan(`     → ${fix.description}`));
    });
  }
}

async function attemptFix(error: ClassifiedError) {
  const spinner = ora('Applying fix...').start();

  const safeFix = error.suggestedFixes.find(f => f.risk === 'safe');
  if (!safeFix) {
    spinner.fail('No safe fix available');
    return;
  }

  try {
    const result = await applyFix(safeFix, error);

    if (result.success) {
      spinner.succeed('Fix applied');
      error.fixed = true;
    } else {
      spinner.fail('Fix failed');
    }
  } catch (e) {
    spinner.fail(`Fix error: ${e}`);
  }
}

function startWatchMode() {
  console.log(chalk.blue('👁️  Watch mode started'));
  console.log(chalk.gray('   Monitoring for errors... (Ctrl+C to stop)\n'));

  // Implementation would use DevWatcher class
  const watcher = new DevWatcher();
  watcher.start(process.cwd());

  process.on('SIGINT', () => {
    watcher.stop();
    process.exit(0);
  });
}
```

---

## MCP Tool Integration

### heal Tool

```typescript
// In MCP server tools array

{
  name: 'heal',
  description: `
    Run the self-healing system to detect and fix errors.

    Options:
    - auto: Automatically apply safe fixes without prompting
    - watch: Start watch mode for continuous healing
    - dryRun: Show what would be fixed without applying
    - severity: Filter by error severity (critical, high, medium, low)

    Examples:
    - heal() - Scan and prompt for fixes
    - heal({ auto: true }) - Auto-fix all safe issues
    - heal({ watch: true }) - Start watch mode
    - heal({ dryRun: true }) - Preview fixes
  `,
  inputSchema: {
    type: 'object',
    properties: {
      auto: {
        type: 'boolean',
        description: 'Auto-fix without prompting'
      },
      watch: {
        type: 'boolean',
        description: 'Watch mode for continuous healing'
      },
      dryRun: {
        type: 'boolean',
        description: 'Preview fixes without applying'
      },
      severity: {
        type: 'string',
        enum: ['critical', 'high', 'medium', 'low'],
        description: 'Filter by severity'
      }
    }
  }
}
```

---

## Confidence Scoring

### Score Calculation

```typescript
// src/lib/healing/confidence.ts

interface ConfidenceFactors {
  patternMatch: number;      // How well error matches known pattern (0-100)
  contextAvailable: number;  // File, line, stack trace available (0-100)
  historicalSuccess: number; // Past success rate for this fix (0-100)
  codeComplexity: number;    // Lower complexity = higher confidence (0-100)
  testCoverage: number;      // Higher coverage = safer to fix (0-100)
}

export function calculateConfidence(factors: ConfidenceFactors): number {
  const weights = {
    patternMatch: 0.35,
    contextAvailable: 0.20,
    historicalSuccess: 0.25,
    codeComplexity: 0.10,
    testCoverage: 0.10
  };

  let score = 0;
  for (const [factor, weight] of Object.entries(weights)) {
    score += factors[factor as keyof ConfidenceFactors] * weight;
  }

  return Math.round(score);
}

// Auto-fix thresholds
export const CONFIDENCE_THRESHOLDS = {
  AUTO_FIX: 90,           // Auto-fix without asking
  SUGGEST_FIX: 70,        // Suggest but ask confirmation
  MANUAL_REVIEW: 50,      // Show fix but recommend manual review
  NO_FIX: 0               // Don't suggest fix
};
```

---

## Usage Examples

### Development Workflow

```bash
# One-time scan and fix
codebakers heal

# Auto-fix all safe issues
codebakers heal --auto

# Watch mode during development
codebakers heal --watch

# Preview what would be fixed
codebakers heal --dry-run

# Fix only critical issues
codebakers heal --severity critical
```

### From Chat (AI-Triggered)

```
User: "My app is showing errors"
AI: Let me run the self-healing diagnostics...

[Calls heal tool]

Found 3 issues:

1. TYPESCRIPT (High)
   Type 'string' is not assignable to type 'number'
   → src/lib/utils.ts:42
   ✓ Auto-fixable (92% confidence)

2. DATABASE (Critical)
   relation "users" does not exist
   → Auto-fix: Run migrations
   ✓ Auto-fixable (95% confidence)

3. CONFIGURATION (High)
   Missing required environment variable: STRIPE_SECRET_KEY
   → Manual: Add to .env.local

Would you like me to apply the auto-fixes?
```

---

## Best Practices

### 1. Gradual Rollout

```typescript
// Start with high-confidence fixes only
const INITIAL_THRESHOLD = 95;

// Gradually lower as system proves reliable
const PRODUCTION_THRESHOLD = 85;
```

### 2. Always Verify

```typescript
// Never mark as fixed without verification
async function fixWithVerification(error, fix) {
  const beforeState = await captureState();

  await applyFix(fix, error);

  const verified = await verifyFix(error);

  if (!verified) {
    await restoreState(beforeState);
    return { success: false, reverted: true };
  }

  return { success: true };
}
```

### 3. Audit Trail

```typescript
// Log all healing actions
interface HealingLog {
  timestamp: Date;
  error: ClassifiedError;
  fixApplied: SuggestedFix | null;
  success: boolean;
  verificationResult: boolean;
  reverted: boolean;
}

// Store in .codebakers/healing-log.json
```

### 4. Human Override

```typescript
// Always allow human override
if (process.env.DISABLE_AUTO_HEALING === 'true') {
  console.log('Auto-healing disabled by environment');
  return;
}

// Emergency stop
if (await checkEmergencyStop()) {
  console.log('Emergency stop triggered - healing paused');
  return;
}
```
