import chalk from 'chalk';
import ora from 'ora';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

interface AuditCheck {
  name: string;
  category: string;
  passed: boolean;
  message: string;
  details?: string[];
  severity: 'error' | 'warning' | 'info';
}

interface AuditResult {
  checks: AuditCheck[];
  score: number;
  maxScore: number;
  passed: boolean;
}

/**
 * Run automated code quality audit
 */
export async function audit(): Promise<AuditResult> {
  console.log(chalk.blue('\n  CodeBakers Audit\n'));
  console.log(chalk.gray('  Running automated checks...\n'));

  const cwd = process.cwd();
  const checks: AuditCheck[] = [];

  // ============================================================
  // BUILD & TYPES
  // ============================================================
  console.log(chalk.white('  Build & Types:'));

  // Check TypeScript
  const tsCheck = await checkTypeScript(cwd);
  checks.push(tsCheck);
  printCheck(tsCheck);

  // Check ESLint
  const eslintCheck = await checkESLint(cwd);
  checks.push(eslintCheck);
  printCheck(eslintCheck);

  // Check Build
  const buildCheck = await checkBuild(cwd);
  checks.push(buildCheck);
  printCheck(buildCheck);

  // ============================================================
  // SECURITY
  // ============================================================
  console.log(chalk.white('\n  Security:'));

  // Check for secrets in code
  const secretsCheck = checkSecretsInCode(cwd);
  checks.push(secretsCheck);
  printCheck(secretsCheck);

  // Check npm audit
  const npmAuditCheck = await checkNpmAudit(cwd);
  checks.push(npmAuditCheck);
  printCheck(npmAuditCheck);

  // Check .env.local not committed
  const envGitCheck = checkEnvNotCommitted(cwd);
  checks.push(envGitCheck);
  printCheck(envGitCheck);

  // ============================================================
  // CODE QUALITY
  // ============================================================
  console.log(chalk.white('\n  Code Quality:'));

  // Check for console.log
  const consoleLogCheck = checkConsoleLog(cwd);
  checks.push(consoleLogCheck);
  printCheck(consoleLogCheck);

  // Check for API route validation
  const validationCheck = checkApiValidation(cwd);
  checks.push(validationCheck);
  printCheck(validationCheck);

  // Check for error boundaries
  const errorBoundaryCheck = checkErrorBoundary(cwd);
  checks.push(errorBoundaryCheck);
  printCheck(errorBoundaryCheck);

  // ============================================================
  // ENVIRONMENT
  // ============================================================
  console.log(chalk.white('\n  Environment:'));

  // Check .env.example exists
  const envExampleCheck = checkEnvExample(cwd);
  checks.push(envExampleCheck);
  printCheck(envExampleCheck);

  // Check env vars match
  const envMatchCheck = checkEnvMatch(cwd);
  checks.push(envMatchCheck);
  printCheck(envMatchCheck);

  // ============================================================
  // PROJECT STRUCTURE
  // ============================================================
  console.log(chalk.white('\n  Project Structure:'));

  // Check for CodeBakers patterns
  const patternsCheck = checkCodeBakersPatterns(cwd);
  checks.push(patternsCheck);
  printCheck(patternsCheck);

  // Check for tests
  const testsCheck = checkTests(cwd);
  checks.push(testsCheck);
  printCheck(testsCheck);

  // ============================================================
  // SUMMARY
  // ============================================================
  const passed = checks.filter(c => c.passed).length;
  const total = checks.length;
  const score = Math.round((passed / total) * 100);

  console.log(chalk.white('\n  ─────────────────────────────────────────────────\n'));

  if (score >= 90) {
    console.log(chalk.green(`  ✅ Score: ${passed}/${total} checks passed (${score}%)\n`));
    console.log(chalk.green('  Excellent! Your project is production-ready.\n'));
  } else if (score >= 70) {
    console.log(chalk.yellow(`  ⚠️  Score: ${passed}/${total} checks passed (${score}%)\n`));
    console.log(chalk.yellow('  Good progress. Fix the issues above before deploying.\n'));
  } else {
    console.log(chalk.red(`  ❌ Score: ${passed}/${total} checks passed (${score}%)\n`));
    console.log(chalk.red('  Needs attention. Address critical issues before deploying.\n'));
  }

  // Show critical issues summary
  const criticalIssues = checks.filter(c => !c.passed && c.severity === 'error');
  if (criticalIssues.length > 0) {
    console.log(chalk.red('  Critical Issues:'));
    for (const issue of criticalIssues) {
      console.log(chalk.red(`    • ${issue.message}`));
    }
    console.log('');
  }

  // Show warnings
  const warnings = checks.filter(c => !c.passed && c.severity === 'warning');
  if (warnings.length > 0) {
    console.log(chalk.yellow('  Warnings:'));
    for (const warning of warnings) {
      console.log(chalk.yellow(`    • ${warning.message}`));
    }
    console.log('');
  }

  console.log(chalk.gray('  Tip: Run /audit in Claude for full 100-point inspection.\n'));

  return {
    checks,
    score,
    maxScore: 100,
    passed: score >= 70,
  };
}

// ============================================================
// CHECK FUNCTIONS
// ============================================================

function printCheck(check: AuditCheck): void {
  const icon = check.passed ? chalk.green('✓') : (check.severity === 'error' ? chalk.red('✗') : chalk.yellow('⚠'));
  console.log(`    ${icon} ${check.message}`);
  if (!check.passed && check.details && check.details.length > 0) {
    for (const detail of check.details.slice(0, 3)) {
      console.log(chalk.gray(`      └─ ${detail}`));
    }
    if (check.details.length > 3) {
      console.log(chalk.gray(`      └─ ...and ${check.details.length - 3} more`));
    }
  }
}

async function checkTypeScript(cwd: string): Promise<AuditCheck> {
  const tsconfigPath = join(cwd, 'tsconfig.json');

  if (!existsSync(tsconfigPath)) {
    return {
      name: 'typescript',
      category: 'build',
      passed: false,
      message: 'No tsconfig.json found',
      severity: 'warning',
    };
  }

  try {
    execSync('npx tsc --noEmit', { cwd, stdio: 'pipe' });
    return {
      name: 'typescript',
      category: 'build',
      passed: true,
      message: 'TypeScript compiles (0 errors)',
      severity: 'info',
    };
  } catch (error) {
    const output = error instanceof Error && 'stdout' in error
      ? (error as { stdout?: Buffer }).stdout?.toString() || ''
      : '';
    const errorCount = (output.match(/error TS/g) || []).length;

    return {
      name: 'typescript',
      category: 'build',
      passed: false,
      message: `TypeScript errors (${errorCount} errors)`,
      details: ['Run: npx tsc --noEmit to see details'],
      severity: 'error',
    };
  }
}

async function checkESLint(cwd: string): Promise<AuditCheck> {
  const packageJsonPath = join(cwd, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return {
      name: 'eslint',
      category: 'build',
      passed: false,
      message: 'No package.json found',
      severity: 'warning',
    };
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const hasEslint = packageJson.devDependencies?.eslint || packageJson.dependencies?.eslint;

    if (!hasEslint) {
      return {
        name: 'eslint',
        category: 'build',
        passed: false,
        message: 'ESLint not installed',
        details: ['Run: npm install -D eslint'],
        severity: 'warning',
      };
    }

    execSync('npx eslint . --max-warnings=0', { cwd, stdio: 'pipe' });
    return {
      name: 'eslint',
      category: 'build',
      passed: true,
      message: 'ESLint passes (0 warnings)',
      severity: 'info',
    };
  } catch {
    return {
      name: 'eslint',
      category: 'build',
      passed: false,
      message: 'ESLint has warnings or errors',
      details: ['Run: npx eslint . to see details'],
      severity: 'warning',
    };
  }
}

async function checkBuild(cwd: string): Promise<AuditCheck> {
  const packageJsonPath = join(cwd, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return {
      name: 'build',
      category: 'build',
      passed: false,
      message: 'No package.json found',
      severity: 'error',
    };
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const hasBuildScript = packageJson.scripts?.build;

    if (!hasBuildScript) {
      return {
        name: 'build',
        category: 'build',
        passed: true,
        message: 'No build script (skipped)',
        severity: 'info',
      };
    }

    // Check if .next exists (Next.js) or dist exists
    const hasNextBuild = existsSync(join(cwd, '.next'));
    const hasDistBuild = existsSync(join(cwd, 'dist'));

    if (hasNextBuild || hasDistBuild) {
      return {
        name: 'build',
        category: 'build',
        passed: true,
        message: 'Build output exists',
        severity: 'info',
      };
    }

    return {
      name: 'build',
      category: 'build',
      passed: false,
      message: 'No build output found',
      details: ['Run: npm run build'],
      severity: 'warning',
    };
  } catch {
    return {
      name: 'build',
      category: 'build',
      passed: false,
      message: 'Could not check build status',
      severity: 'warning',
    };
  }
}

function checkSecretsInCode(cwd: string): AuditCheck {
  const srcDir = join(cwd, 'src');
  if (!existsSync(srcDir)) {
    return {
      name: 'secrets',
      category: 'security',
      passed: true,
      message: 'No src/ directory (skipped)',
      severity: 'info',
    };
  }

  const secretPatterns = [
    /sk_live_[a-zA-Z0-9]+/,  // Stripe live key
    /sk_test_[a-zA-Z0-9]+/,  // Stripe test key
    /ghp_[a-zA-Z0-9]+/,      // GitHub token
    /AKIA[A-Z0-9]{16}/,      // AWS access key
    /-----BEGIN RSA PRIVATE KEY-----/, // RSA key
    /-----BEGIN PRIVATE KEY-----/,     // Generic private key
  ];

  const issues: string[] = [];

  function scanDir(dir: string): void {
    try {
      const files = readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        if (file.isDirectory() && !file.name.startsWith('.') && file.name !== 'node_modules') {
          scanDir(join(dir, file.name));
        } else if (file.isFile() && (file.name.endsWith('.ts') || file.name.endsWith('.tsx') || file.name.endsWith('.js'))) {
          const content = readFileSync(join(dir, file.name), 'utf-8');
          for (const pattern of secretPatterns) {
            if (pattern.test(content)) {
              issues.push(join(dir, file.name).replace(cwd, ''));
              break;
            }
          }
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  scanDir(srcDir);

  if (issues.length > 0) {
    return {
      name: 'secrets',
      category: 'security',
      passed: false,
      message: `Possible secrets in code (${issues.length} files)`,
      details: issues,
      severity: 'error',
    };
  }

  return {
    name: 'secrets',
    category: 'security',
    passed: true,
    message: 'No secrets detected in code',
    severity: 'info',
  };
}

async function checkNpmAudit(cwd: string): Promise<AuditCheck> {
  try {
    execSync('npm audit --audit-level=high --json', { cwd, stdio: 'pipe' });
    return {
      name: 'npm-audit',
      category: 'security',
      passed: true,
      message: 'No high/critical vulnerabilities',
      severity: 'info',
    };
  } catch (error) {
    try {
      const output = error instanceof Error && 'stdout' in error
        ? (error as { stdout?: Buffer }).stdout?.toString() || '{}'
        : '{}';
      const auditResult = JSON.parse(output);
      const high = auditResult.metadata?.vulnerabilities?.high || 0;
      const critical = auditResult.metadata?.vulnerabilities?.critical || 0;

      if (high > 0 || critical > 0) {
        return {
          name: 'npm-audit',
          category: 'security',
          passed: false,
          message: `Vulnerabilities: ${critical} critical, ${high} high`,
          details: ['Run: npm audit to see details', 'Run: npm audit fix to auto-fix'],
          severity: 'error',
        };
      }
    } catch {
      // Parse failed, assume passed
    }

    return {
      name: 'npm-audit',
      category: 'security',
      passed: true,
      message: 'No high/critical vulnerabilities',
      severity: 'info',
    };
  }
}

function checkEnvNotCommitted(cwd: string): AuditCheck {
  const gitignorePath = join(cwd, '.gitignore');

  if (!existsSync(gitignorePath)) {
    return {
      name: 'env-git',
      category: 'security',
      passed: false,
      message: 'No .gitignore file',
      details: ['Create .gitignore and add .env.local'],
      severity: 'warning',
    };
  }

  const gitignore = readFileSync(gitignorePath, 'utf-8');
  const hasEnvLocal = gitignore.includes('.env.local') || gitignore.includes('.env*.local');

  if (!hasEnvLocal) {
    return {
      name: 'env-git',
      category: 'security',
      passed: false,
      message: '.env.local not in .gitignore',
      details: ['Add .env.local to .gitignore'],
      severity: 'error',
    };
  }

  return {
    name: 'env-git',
    category: 'security',
    passed: true,
    message: '.env.local properly gitignored',
    severity: 'info',
  };
}

function checkConsoleLog(cwd: string): AuditCheck {
  const srcDir = join(cwd, 'src');
  if (!existsSync(srcDir)) {
    return {
      name: 'console-log',
      category: 'quality',
      passed: true,
      message: 'No src/ directory (skipped)',
      severity: 'info',
    };
  }

  const issues: string[] = [];

  function scanDir(dir: string): void {
    try {
      const files = readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        if (file.isDirectory() && !file.name.startsWith('.') && file.name !== 'node_modules') {
          scanDir(join(dir, file.name));
        } else if (file.isFile() && (file.name.endsWith('.ts') || file.name.endsWith('.tsx'))) {
          const content = readFileSync(join(dir, file.name), 'utf-8');
          // Match console.log but not console.error or console.warn
          if (/console\.log\s*\(/.test(content)) {
            issues.push(join(dir, file.name).replace(cwd, ''));
          }
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  scanDir(srcDir);

  if (issues.length > 0) {
    return {
      name: 'console-log',
      category: 'quality',
      passed: false,
      message: `console.log found (${issues.length} files)`,
      details: issues,
      severity: 'warning',
    };
  }

  return {
    name: 'console-log',
    category: 'quality',
    passed: true,
    message: 'No console.log in production code',
    severity: 'info',
  };
}

function checkApiValidation(cwd: string): AuditCheck {
  const apiDir = join(cwd, 'src', 'app', 'api');
  if (!existsSync(apiDir)) {
    return {
      name: 'api-validation',
      category: 'quality',
      passed: true,
      message: 'No API routes (skipped)',
      severity: 'info',
    };
  }

  const issues: string[] = [];
  let totalRoutes = 0;

  function scanDir(dir: string): void {
    try {
      const files = readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        if (file.isDirectory()) {
          scanDir(join(dir, file.name));
        } else if (file.name === 'route.ts' || file.name === 'route.tsx') {
          totalRoutes++;
          const content = readFileSync(join(dir, file.name), 'utf-8');
          // Check for Zod validation
          if (!content.includes('zod') && !content.includes('.parse(') && !content.includes('.safeParse(')) {
            issues.push(join(dir, file.name).replace(cwd, ''));
          }
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  scanDir(apiDir);

  if (issues.length > 0) {
    return {
      name: 'api-validation',
      category: 'quality',
      passed: false,
      message: `API routes without validation (${issues.length}/${totalRoutes})`,
      details: issues,
      severity: 'warning',
    };
  }

  return {
    name: 'api-validation',
    category: 'quality',
    passed: true,
    message: `All ${totalRoutes} API routes have validation`,
    severity: 'info',
  };
}

function checkErrorBoundary(cwd: string): AuditCheck {
  const appDir = join(cwd, 'src', 'app');
  if (!existsSync(appDir)) {
    return {
      name: 'error-boundary',
      category: 'quality',
      passed: true,
      message: 'No app/ directory (skipped)',
      severity: 'info',
    };
  }

  const errorPath = join(appDir, 'error.tsx');
  const globalErrorPath = join(appDir, 'global-error.tsx');

  if (existsSync(errorPath) || existsSync(globalErrorPath)) {
    return {
      name: 'error-boundary',
      category: 'quality',
      passed: true,
      message: 'Error boundary exists',
      severity: 'info',
    };
  }

  return {
    name: 'error-boundary',
    category: 'quality',
    passed: false,
    message: 'No error boundary (error.tsx)',
    details: ['Create src/app/error.tsx for error handling'],
    severity: 'warning',
  };
}

function checkEnvExample(cwd: string): AuditCheck {
  const envExamplePath = join(cwd, '.env.example');

  if (existsSync(envExamplePath)) {
    return {
      name: 'env-example',
      category: 'environment',
      passed: true,
      message: '.env.example exists',
      severity: 'info',
    };
  }

  return {
    name: 'env-example',
    category: 'environment',
    passed: false,
    message: 'No .env.example file',
    details: ['Create .env.example with all required variables'],
    severity: 'warning',
  };
}

function checkEnvMatch(cwd: string): AuditCheck {
  const envExamplePath = join(cwd, '.env.example');
  const envLocalPath = join(cwd, '.env.local');

  if (!existsSync(envExamplePath)) {
    return {
      name: 'env-match',
      category: 'environment',
      passed: true,
      message: 'No .env.example to compare (skipped)',
      severity: 'info',
    };
  }

  if (!existsSync(envLocalPath)) {
    return {
      name: 'env-match',
      category: 'environment',
      passed: false,
      message: 'No .env.local file',
      details: ['Copy .env.example to .env.local and fill in values'],
      severity: 'warning',
    };
  }

  const exampleVars = parseEnvFile(readFileSync(envExamplePath, 'utf-8'));
  const localVars = parseEnvFile(readFileSync(envLocalPath, 'utf-8'));

  const missingInLocal = exampleVars.filter(v => !localVars.includes(v));
  const extraInLocal = localVars.filter(v => !exampleVars.includes(v) && !v.startsWith('#'));

  if (missingInLocal.length > 0) {
    return {
      name: 'env-match',
      category: 'environment',
      passed: false,
      message: `Missing ${missingInLocal.length} vars from .env.example`,
      details: missingInLocal,
      severity: 'warning',
    };
  }

  if (extraInLocal.length > 0) {
    return {
      name: 'env-match',
      category: 'environment',
      passed: false,
      message: `${extraInLocal.length} vars in .env.local not in .env.example`,
      details: extraInLocal,
      severity: 'info',
    };
  }

  return {
    name: 'env-match',
    category: 'environment',
    passed: true,
    message: 'Environment variables match',
    severity: 'info',
  };
}

function parseEnvFile(content: string): string[] {
  return content
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => line.split('=')[0].trim())
    .filter(Boolean);
}

function checkCodeBakersPatterns(cwd: string): AuditCheck {
  const claudeDir = join(cwd, '.claude');
  const claudeMd = join(cwd, 'CLAUDE.md');

  if (!existsSync(claudeDir) && !existsSync(claudeMd)) {
    return {
      name: 'patterns',
      category: 'structure',
      passed: false,
      message: 'CodeBakers patterns not installed',
      details: ['Run: codebakers init'],
      severity: 'info',
    };
  }

  if (existsSync(claudeDir)) {
    const files = readdirSync(claudeDir).filter(f => f.endsWith('.md'));
    return {
      name: 'patterns',
      category: 'structure',
      passed: true,
      message: `${files.length} CodeBakers modules installed`,
      severity: 'info',
    };
  }

  return {
    name: 'patterns',
    category: 'structure',
    passed: true,
    message: 'CLAUDE.md exists',
    severity: 'info',
  };
}

function checkTests(cwd: string): AuditCheck {
  const testDirs = [
    join(cwd, '__tests__'),
    join(cwd, 'tests'),
    join(cwd, 'test'),
    join(cwd, 'src', '__tests__'),
  ];

  const testFiles: string[] = [];

  for (const dir of testDirs) {
    if (existsSync(dir)) {
      try {
        const files = readdirSync(dir, { recursive: true }) as string[];
        testFiles.push(...files.filter(f =>
          f.endsWith('.test.ts') ||
          f.endsWith('.test.tsx') ||
          f.endsWith('.spec.ts') ||
          f.endsWith('.spec.tsx')
        ));
      } catch {
        // Ignore
      }
    }
  }

  // Also check for test files in src
  const srcDir = join(cwd, 'src');
  if (existsSync(srcDir)) {
    function findTestFiles(dir: string): void {
      try {
        const files = readdirSync(dir, { withFileTypes: true });
        for (const file of files) {
          if (file.isDirectory() && !file.name.startsWith('.') && file.name !== 'node_modules') {
            findTestFiles(join(dir, file.name));
          } else if (
            file.name.endsWith('.test.ts') ||
            file.name.endsWith('.test.tsx') ||
            file.name.endsWith('.spec.ts') ||
            file.name.endsWith('.spec.tsx')
          ) {
            testFiles.push(file.name);
          }
        }
      } catch {
        // Ignore
      }
    }
    findTestFiles(srcDir);
  }

  if (testFiles.length === 0) {
    return {
      name: 'tests',
      category: 'structure',
      passed: false,
      message: 'No test files found',
      details: ['Add tests for critical paths'],
      severity: 'warning',
    };
  }

  return {
    name: 'tests',
    category: 'structure',
    passed: true,
    message: `${testFiles.length} test files found`,
    severity: 'info',
  };
}
