import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';
import { execSync, spawn } from 'child_process';

// ============================================================================
// TYPES
// ============================================================================

type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

type ErrorCategory =
  | 'typescript'
  | 'runtime'
  | 'build'
  | 'dependency'
  | 'database'
  | 'auth'
  | 'api'
  | 'performance'
  | 'security'
  | 'configuration'
  | 'network'
  | 'unknown';

interface ClassifiedError {
  id: string;
  timestamp: Date;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  stack?: string;
  file?: string;
  line?: number;
  column?: number;
  autoFixable: boolean;
  confidence: number;
  suggestedFixes: SuggestedFix[];
  fixed?: boolean;
}

interface SuggestedFix {
  id: string;
  description: string;
  code?: string;
  file?: string;
  confidence: number;
  risk: 'safe' | 'moderate' | 'risky';
  requiresReview: boolean;
  command?: string;
}

interface HealOptions {
  auto?: boolean;
  watch?: boolean;
  severity?: string;
  dryRun?: boolean;
}

interface HealResult {
  errors: ClassifiedError[];
  fixed: number;
  remaining: number;
}

// ============================================================================
// ERROR CLASSIFICATION
// ============================================================================

interface ClassificationRule {
  category: ErrorCategory;
  severity: ErrorSeverity;
  pattern: RegExp;
  autoFixable: boolean;
  confidence: number;
  fixId: string;
  fixDescription: string;
  fixCommand?: string;
  risk: 'safe' | 'moderate' | 'risky';
}

const ERROR_PATTERNS: ClassificationRule[] = [
  // TypeScript Errors
  {
    category: 'typescript',
    severity: 'high',
    pattern: /TS2307.*Cannot find module '([^']+)'/,
    autoFixable: true,
    confidence: 90,
    fixId: 'install_module',
    fixDescription: 'Install missing module',
    risk: 'safe'
  },
  {
    category: 'typescript',
    severity: 'medium',
    pattern: /TS2322.*Type '([^']+)' is not assignable to type '([^']+)'/,
    autoFixable: false,
    confidence: 60,
    fixId: 'fix_type',
    fixDescription: 'Fix type mismatch',
    risk: 'moderate'
  },
  {
    category: 'typescript',
    severity: 'medium',
    pattern: /TS2339.*Property '([^']+)' does not exist on type '([^']+)'/,
    autoFixable: false,
    confidence: 70,
    fixId: 'add_property',
    fixDescription: 'Add missing property to type',
    risk: 'moderate'
  },
  {
    category: 'typescript',
    severity: 'low',
    pattern: /TS7006.*Parameter '([^']+)' implicitly has an 'any' type/,
    autoFixable: false,
    confidence: 80,
    fixId: 'add_type',
    fixDescription: 'Add explicit type annotation',
    risk: 'safe'
  },

  // Dependency Errors
  {
    category: 'dependency',
    severity: 'high',
    pattern: /Module not found: Can't resolve '([^']+)'/,
    autoFixable: true,
    confidence: 90,
    fixId: 'install_package',
    fixDescription: 'Install missing package',
    risk: 'safe'
  },
  {
    category: 'dependency',
    severity: 'high',
    pattern: /Cannot find module '([^']+)'/,
    autoFixable: true,
    confidence: 85,
    fixId: 'install_package',
    fixDescription: 'Install missing package',
    risk: 'safe'
  },

  // Database Errors
  {
    category: 'database',
    severity: 'critical',
    pattern: /connect ECONNREFUSED/,
    autoFixable: false,
    confidence: 95,
    fixId: 'check_db',
    fixDescription: 'Check database connection - ensure database is running',
    risk: 'safe'
  },
  {
    category: 'database',
    severity: 'high',
    pattern: /relation "([^"]+)" does not exist/,
    autoFixable: true,
    confidence: 90,
    fixId: 'run_migrations',
    fixDescription: 'Run database migrations',
    fixCommand: 'npx drizzle-kit push',
    risk: 'moderate'
  },

  // Auth Errors
  {
    category: 'auth',
    severity: 'critical',
    pattern: /AUTH_SECRET.*missing|undefined|AUTH_SECRET is not set/i,
    autoFixable: true,
    confidence: 95,
    fixId: 'generate_auth_secret',
    fixDescription: 'Generate AUTH_SECRET',
    risk: 'safe'
  },

  // Configuration Errors
  {
    category: 'configuration',
    severity: 'high',
    pattern: /Missing required environment variable:?\s*([A-Z_]+)/i,
    autoFixable: false,
    confidence: 95,
    fixId: 'add_env_var',
    fixDescription: 'Add missing environment variable',
    risk: 'safe'
  },
  {
    category: 'configuration',
    severity: 'high',
    pattern: /NEXT_PUBLIC_([A-Z_]+).*undefined/,
    autoFixable: false,
    confidence: 90,
    fixId: 'add_env_var',
    fixDescription: 'Add missing public environment variable',
    risk: 'safe'
  },

  // Security Errors
  {
    category: 'security',
    severity: 'high',
    pattern: /found (\d+) vulnerabilit(y|ies)/i,
    autoFixable: true,
    confidence: 80,
    fixId: 'npm_audit_fix',
    fixDescription: 'Run npm audit fix',
    fixCommand: 'npm audit fix',
    risk: 'moderate'
  },
  {
    category: 'security',
    severity: 'critical',
    pattern: /(\d+) critical/i,
    autoFixable: false,
    confidence: 90,
    fixId: 'npm_audit_fix_critical',
    fixDescription: 'Review and fix critical vulnerabilities manually',
    risk: 'risky'
  },

  // Build Errors
  {
    category: 'build',
    severity: 'high',
    pattern: /Build failed|Failed to compile/i,
    autoFixable: false,
    confidence: 50,
    fixId: 'fix_build',
    fixDescription: 'Review build errors',
    risk: 'moderate'
  },

  // Runtime Errors
  {
    category: 'runtime',
    severity: 'high',
    pattern: /Cannot read propert(y|ies) of (undefined|null)/,
    autoFixable: false,
    confidence: 70,
    fixId: 'add_null_check',
    fixDescription: 'Add null/undefined check',
    risk: 'safe'
  },
  {
    category: 'runtime',
    severity: 'high',
    pattern: /([A-Za-z]+) is not defined/,
    autoFixable: false,
    confidence: 75,
    fixId: 'add_import',
    fixDescription: 'Add missing import or declaration',
    risk: 'safe'
  }
];

function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function classifyError(errorText: string, file?: string, line?: number): ClassifiedError {
  for (const rule of ERROR_PATTERNS) {
    const match = errorText.match(rule.pattern);
    if (match) {
      return {
        id: generateErrorId(),
        timestamp: new Date(),
        category: rule.category,
        severity: rule.severity,
        message: errorText.trim(),
        file,
        line,
        autoFixable: rule.autoFixable,
        confidence: rule.confidence,
        suggestedFixes: [{
          id: rule.fixId,
          description: rule.fixDescription,
          confidence: rule.confidence,
          risk: rule.risk,
          requiresReview: rule.risk !== 'safe',
          command: rule.fixCommand
        }]
      };
    }
  }

  // Unknown error
  return {
    id: generateErrorId(),
    timestamp: new Date(),
    category: 'unknown',
    severity: 'medium',
    message: errorText.trim(),
    file,
    line,
    autoFixable: false,
    confidence: 0,
    suggestedFixes: []
  };
}

// ============================================================================
// ERROR SCANNING
// ============================================================================

async function scanTypeScriptErrors(): Promise<ClassifiedError[]> {
  const errors: ClassifiedError[] = [];

  try {
    execSync('npx tsc --noEmit 2>&1', { encoding: 'utf-8', stdio: 'pipe' });
  } catch (error: any) {
    const output = error.stdout || error.stderr || error.message || '';
    const lines = output.split('\n');

    let currentFile = '';
    let currentLine = 0;

    for (const line of lines) {
      // Match file:line:col pattern
      const fileMatch = line.match(/^([^:]+):(\d+):(\d+)/);
      if (fileMatch) {
        currentFile = fileMatch[1];
        currentLine = parseInt(fileMatch[2], 10);
      }

      // Match TS error codes
      const tsMatch = line.match(/error (TS\d+):/);
      if (tsMatch) {
        const classified = classifyError(line, currentFile, currentLine);
        errors.push(classified);
      }
    }
  }

  return errors;
}

async function scanBuildErrors(): Promise<ClassifiedError[]> {
  const errors: ClassifiedError[] = [];

  try {
    // Check if build script exists
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'));
    if (!packageJson.scripts?.build) {
      return errors;
    }

    execSync('npm run build 2>&1', { encoding: 'utf-8', stdio: 'pipe' });
  } catch (error: any) {
    const output = error.stdout || error.stderr || error.message || '';
    const lines = output.split('\n');

    for (const line of lines) {
      if (line.includes('error') || line.includes('Error') || line.includes('failed')) {
        const classified = classifyError(line);
        // Avoid duplicates from TS errors
        if (classified.category !== 'typescript') {
          errors.push(classified);
        }
      }
    }
  }

  return errors;
}

async function scanEnvironmentIssues(): Promise<ClassifiedError[]> {
  const errors: ClassifiedError[] = [];

  // Check for .env files
  const envFiles = ['.env', '.env.local', '.env.development'];
  let hasEnvFile = false;

  for (const file of envFiles) {
    try {
      await fs.access(file);
      hasEnvFile = true;
      break;
    } catch {
      // File doesn't exist
    }
  }

  if (!hasEnvFile) {
    errors.push({
      id: generateErrorId(),
      timestamp: new Date(),
      category: 'configuration',
      severity: 'high',
      message: 'No .env file found - environment variables may not be configured',
      autoFixable: false,
      confidence: 90,
      suggestedFixes: [{
        id: 'create_env',
        description: 'Create .env.local file with required variables',
        confidence: 90,
        risk: 'safe',
        requiresReview: true
      }]
    });
  }

  // Check for AUTH_SECRET if using auth
  try {
    const envContent = await fs.readFile('.env.local', 'utf-8').catch(() => '');
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'));

    const hasAuth = packageJson.dependencies?.['next-auth'] ||
      packageJson.dependencies?.['@auth/core'] ||
      packageJson.dependencies?.['@supabase/auth-helpers-nextjs'];

    if (hasAuth && !envContent.includes('AUTH_SECRET')) {
      errors.push({
        id: generateErrorId(),
        timestamp: new Date(),
        category: 'auth',
        severity: 'critical',
        message: 'AUTH_SECRET not found in .env.local - authentication will not work',
        autoFixable: true,
        confidence: 95,
        suggestedFixes: [{
          id: 'generate_auth_secret',
          description: 'Generate and add AUTH_SECRET to .env.local',
          confidence: 95,
          risk: 'safe',
          requiresReview: false
        }]
      });
    }
  } catch {
    // Skip if can't read files
  }

  return errors;
}

async function scanSecurityIssues(): Promise<ClassifiedError[]> {
  const errors: ClassifiedError[] = [];

  try {
    const output = execSync('npm audit --json 2>&1', { encoding: 'utf-8', stdio: 'pipe' });
    const audit = JSON.parse(output);

    if (audit.metadata?.vulnerabilities) {
      const { critical, high, moderate, low } = audit.metadata.vulnerabilities;

      if (critical > 0) {
        errors.push({
          id: generateErrorId(),
          timestamp: new Date(),
          category: 'security',
          severity: 'critical',
          message: `${critical} critical vulnerabilities found`,
          autoFixable: false,
          confidence: 95,
          suggestedFixes: [{
            id: 'npm_audit_fix',
            description: 'Run npm audit fix --force (may have breaking changes)',
            confidence: 70,
            risk: 'risky',
            requiresReview: true,
            command: 'npm audit fix --force'
          }]
        });
      }

      if (high > 0) {
        errors.push({
          id: generateErrorId(),
          timestamp: new Date(),
          category: 'security',
          severity: 'high',
          message: `${high} high-severity vulnerabilities found`,
          autoFixable: true,
          confidence: 85,
          suggestedFixes: [{
            id: 'npm_audit_fix',
            description: 'Run npm audit fix',
            confidence: 85,
            risk: 'moderate',
            requiresReview: false,
            command: 'npm audit fix'
          }]
        });
      }

      if (moderate > 0) {
        errors.push({
          id: generateErrorId(),
          timestamp: new Date(),
          category: 'security',
          severity: 'medium',
          message: `${moderate} moderate vulnerabilities found`,
          autoFixable: true,
          confidence: 90,
          suggestedFixes: [{
            id: 'npm_audit_fix',
            description: 'Run npm audit fix',
            confidence: 90,
            risk: 'safe',
            requiresReview: false,
            command: 'npm audit fix'
          }]
        });
      }
    }
  } catch {
    // npm audit failed or no issues
  }

  return errors;
}

async function scanDatabaseIssues(): Promise<ClassifiedError[]> {
  const errors: ClassifiedError[] = [];

  try {
    // Check if using Drizzle
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'));
    if (!packageJson.dependencies?.['drizzle-orm']) {
      return errors;
    }

    // Check for migrations folder
    const migrationsPaths = ['drizzle', 'src/db/migrations', 'migrations'];
    let hasMigrations = false;

    for (const migPath of migrationsPaths) {
      try {
        const stat = await fs.stat(migPath);
        if (stat.isDirectory()) {
          const files = await fs.readdir(migPath);
          if (files.some(f => f.endsWith('.sql'))) {
            hasMigrations = true;
            break;
          }
        }
      } catch {
        // Directory doesn't exist
      }
    }

    if (!hasMigrations) {
      errors.push({
        id: generateErrorId(),
        timestamp: new Date(),
        category: 'database',
        severity: 'medium',
        message: 'No database migrations found - schema may not be pushed',
        autoFixable: true,
        confidence: 85,
        suggestedFixes: [{
          id: 'generate_migrations',
          description: 'Generate and push migrations',
          confidence: 85,
          risk: 'moderate',
          requiresReview: true,
          command: 'npx drizzle-kit generate && npx drizzle-kit push'
        }]
      });
    }
  } catch {
    // Skip if can't read package.json
  }

  return errors;
}

// ============================================================================
// FIX APPLICATION
// ============================================================================

async function applyFix(error: ClassifiedError, fix: SuggestedFix): Promise<boolean> {
  switch (fix.id) {
    case 'install_package':
    case 'install_module':
      return await installMissingPackage(error);

    case 'generate_auth_secret':
      return await generateAuthSecret();

    case 'npm_audit_fix':
      return await runCommand('npm audit fix');

    case 'run_migrations':
      return await runCommand('npx drizzle-kit push');

    case 'generate_migrations':
      return await runCommand('npx drizzle-kit generate && npx drizzle-kit push');

    default:
      if (fix.command) {
        return await runCommand(fix.command);
      }
      return false;
  }
}

async function installMissingPackage(error: ClassifiedError): Promise<boolean> {
  // Extract package name from error message
  const match = error.message.match(/(?:Cannot find module|Can't resolve) '([^']+)'/);
  if (!match) return false;

  let packageName = match[1];

  // Skip relative imports
  if (packageName.startsWith('.') || packageName.startsWith('@/')) {
    return false;
  }

  // Extract base package name (handle scoped packages and subpaths)
  if (packageName.startsWith('@')) {
    packageName = packageName.split('/').slice(0, 2).join('/');
  } else {
    packageName = packageName.split('/')[0];
  }

  return await runCommand(`npm install ${packageName}`);
}

async function generateAuthSecret(): Promise<boolean> {
  try {
    const crypto = await import('crypto');
    const secret = crypto.randomBytes(32).toString('base64');

    let envContent = '';
    try {
      envContent = await fs.readFile('.env.local', 'utf-8');
    } catch {
      // File doesn't exist, create it
    }

    if (envContent.includes('AUTH_SECRET=')) {
      envContent = envContent.replace(/AUTH_SECRET=.*/, `AUTH_SECRET=${secret}`);
    } else {
      envContent += `\nAUTH_SECRET=${secret}\n`;
    }

    await fs.writeFile('.env.local', envContent.trim() + '\n');
    return true;
  } catch {
    return false;
  }
}

async function runCommand(command: string): Promise<boolean> {
  try {
    execSync(command, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// DISPLAY
// ============================================================================

function displayError(error: ClassifiedError): void {
  const severityColors: Record<ErrorSeverity, typeof chalk.red> = {
    critical: chalk.red,
    high: chalk.red,
    medium: chalk.yellow,
    low: chalk.blue,
    info: chalk.gray
  };

  const severityIcons: Record<ErrorSeverity, string> = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🔵',
    info: 'ℹ️'
  };

  const color = severityColors[error.severity];
  const icon = severityIcons[error.severity];

  console.log(`\n${icon} ${color(chalk.bold(error.category.toUpperCase()))} (${error.severity})`);
  console.log(chalk.white(`   ${error.message}`));

  if (error.file) {
    console.log(chalk.gray(`   📁 ${error.file}${error.line ? `:${error.line}` : ''}`));
  }

  if (error.autoFixable) {
    console.log(chalk.green(`   ✓ Auto-fixable (${error.confidence}% confidence)`));
  }

  for (const fix of error.suggestedFixes) {
    const riskColor = fix.risk === 'safe' ? chalk.green :
      fix.risk === 'moderate' ? chalk.yellow : chalk.red;
    console.log(chalk.cyan(`   → ${fix.description}`) + riskColor(` [${fix.risk}]`));
    if (fix.command) {
      console.log(chalk.gray(`     $ ${fix.command}`));
    }
  }
}

// ============================================================================
// MAIN HEAL FUNCTION
// ============================================================================

export async function heal(options: HealOptions = {}): Promise<HealResult> {
  console.log(chalk.blue('\n🏥 CodeBakers Self-Healing System\n'));
  console.log(chalk.gray('Scanning for issues...\n'));

  const allErrors: ClassifiedError[] = [];

  // Scan for all types of errors
  const scanners = [
    { name: 'TypeScript', fn: scanTypeScriptErrors },
    { name: 'Build', fn: scanBuildErrors },
    { name: 'Environment', fn: scanEnvironmentIssues },
    { name: 'Security', fn: scanSecurityIssues },
    { name: 'Database', fn: scanDatabaseIssues }
  ];

  for (const scanner of scanners) {
    const spinner = ora(`Checking ${scanner.name}...`).start();
    try {
      const errors = await scanner.fn();
      allErrors.push(...errors);
      if (errors.length > 0) {
        spinner.warn(`${scanner.name}: ${errors.length} issue(s)`);
      } else {
        spinner.succeed(`${scanner.name}: OK`);
      }
    } catch (error) {
      spinner.fail(`${scanner.name}: Error scanning`);
    }
  }

  // Filter by severity if specified
  let errors = allErrors;
  if (options.severity) {
    errors = errors.filter(e => e.severity === options.severity);
  }

  // Remove duplicates by message
  const seen = new Set<string>();
  errors = errors.filter(e => {
    if (seen.has(e.message)) return false;
    seen.add(e.message);
    return true;
  });

  console.log('');

  if (errors.length === 0) {
    console.log(chalk.green('✨ No issues found! Your project is healthy.\n'));
    return { errors: [], fixed: 0, remaining: 0 };
  }

  console.log(chalk.yellow(`Found ${errors.length} issue(s):`));

  // Sort by severity
  const severityOrder: ErrorSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
  errors.sort((a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity));

  // Display all errors
  for (const error of errors) {
    displayError(error);
  }

  console.log('');

  // Apply fixes
  let fixed = 0;

  if (!options.dryRun) {
    const fixableErrors = errors.filter(e =>
      e.autoFixable &&
      e.confidence >= 80 &&
      e.suggestedFixes.some(f => f.risk !== 'risky')
    );

    if (fixableErrors.length > 0) {
      console.log(chalk.blue(`\n🔧 Applying ${fixableErrors.length} auto-fix(es)...\n`));

      for (const error of fixableErrors) {
        const safeFix = error.suggestedFixes.find(f => f.risk !== 'risky');
        if (!safeFix) continue;

        if (!options.auto) {
          // In non-auto mode, we just show what would be fixed
          console.log(chalk.gray(`Would fix: ${error.category} - ${safeFix.description}`));
          continue;
        }

        const spinner = ora(`Fixing: ${safeFix.description}`).start();

        try {
          const success = await applyFix(error, safeFix);
          if (success) {
            spinner.succeed(`Fixed: ${safeFix.description}`);
            error.fixed = true;
            fixed++;
          } else {
            spinner.fail(`Failed: ${safeFix.description}`);
          }
        } catch (err) {
          spinner.fail(`Error: ${safeFix.description}`);
        }
      }
    }
  }

  // Summary
  const remaining = errors.length - fixed;

  console.log(chalk.blue('\n📊 Summary'));
  console.log(`   Total issues: ${chalk.white(errors.length)}`);
  console.log(`   Fixed: ${chalk.green(fixed)}`);
  console.log(`   Remaining: ${remaining > 0 ? chalk.yellow(remaining) : chalk.green(0)}`);

  if (options.dryRun) {
    console.log(chalk.gray('\n   [Dry run - no changes made]'));
  } else if (!options.auto && errors.some(e => e.autoFixable)) {
    console.log(chalk.gray('\n   Run with --auto to apply fixes automatically'));
  }

  console.log('');

  return {
    errors,
    fixed,
    remaining
  };
}

// ============================================================================
// WATCH MODE
// ============================================================================

export async function healWatch(): Promise<void> {
  console.log(chalk.blue('\n👁️  Self-Healing Watch Mode\n'));
  console.log(chalk.gray('Monitoring for errors... (Ctrl+C to stop)\n'));

  // Initial scan
  await heal({ auto: true });

  // Watch for file changes using dynamic import
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let chokidarModule: any = null;
  try {
    // @ts-ignore - chokidar is an optional dependency for watch mode
    chokidarModule = await import('chokidar');
  } catch {
    console.log(chalk.yellow('\nWatch mode requires chokidar:'));
    console.log(chalk.cyan('  npm install -D chokidar\n'));
    console.log(chalk.gray('For now, run `codebakers heal` manually after making changes.'));
    return;
  }

  const watcher = chokidarModule.watch(['src/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}'], {
    ignored: /node_modules/,
    persistent: true,
    ignoreInitial: true
  });

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  watcher.on('change', (filePath: string) => {
    console.log(chalk.gray(`\nFile changed: ${filePath}`));

    // Debounce to avoid running multiple times
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
      await heal({ auto: true });
    }, 1000);
  });

  // Keep process alive
  process.on('SIGINT', () => {
    console.log(chalk.blue('\n\n👋 Watch mode stopped\n'));
    watcher.close();
    process.exit(0);
  });
}
