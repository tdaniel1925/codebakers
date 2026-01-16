import chalk from 'chalk';
import { existsSync, mkdirSync, writeFileSync, chmodSync, readFileSync } from 'fs';
import { join } from 'path';

const PRE_COMMIT_SCRIPT = `#!/bin/sh
# CodeBakers Pre-Commit Hook - Real Code Validation
# Actually scans code for pattern violations

# Run the validation script
node "$(dirname "$0")/validate-code.js"
exit $?
`;

const VALIDATE_CODE_SCRIPT = `#!/usr/bin/env node
/**
 * CodeBakers Pre-Commit Code Validator
 * Actually validates code against patterns - not just honor system
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RED = '\\x1b[31m';
const GREEN = '\\x1b[32m';
const YELLOW = '\\x1b[33m';
const CYAN = '\\x1b[36m';
const DIM = '\\x1b[2m';
const RESET = '\\x1b[0m';

function log(color, message) {
  console.log(color + message + RESET);
}

// Get staged files
function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf-8' });
    return output.split('\\n').filter(f => f.trim() && (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.jsx')));
  } catch {
    return [];
  }
}

// Pattern violations to check
const CHECKS = [
  {
    name: 'API Error Handling',
    test: (content, file) => {
      if (!file.includes('/api/') && !file.includes('route.ts')) return null;
      if (!content.includes('try {') && !content.includes('try{')) {
        return 'API route missing try/catch error handling';
      }
      return null;
    }
  },
  {
    name: 'Zod Validation',
    test: (content, file) => {
      if (!file.includes('/api/') && !file.includes('route.ts')) return null;
      // Check if it's a POST/PUT/PATCH that should have validation
      if ((content.includes('POST') || content.includes('PUT') || content.includes('PATCH')) &&
          content.includes('req.json()') &&
          !content.includes('z.object') &&
          !content.includes('schema.parse') &&
          !content.includes('Schema.parse')) {
        return 'API route accepts body but missing Zod validation';
      }
      return null;
    }
  },
  {
    name: 'Console Statements',
    test: (content, file) => {
      // Allow in test files and scripts
      if (file.includes('.test.') || file.includes('/tests/') || file.includes('/scripts/')) return null;
      const lines = content.split('\\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip commented lines
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
        if (line.includes('console.log(') || line.includes('console.error(') || line.includes('console.warn(')) {
          return \`Console statement found at line \${i + 1} - use proper logging\`;
        }
      }
      return null;
    }
  },
  {
    name: 'Hardcoded Secrets',
    test: (content, file) => {
      // Skip env files and configs
      if (file.includes('.env') || file.includes('config')) return null;
      const patterns = [
        /api[_-]?key\\s*[:=]\\s*['"][a-zA-Z0-9]{20,}['"]/i,
        /secret\\s*[:=]\\s*['"][a-zA-Z0-9]{20,}['"]/i,
        /password\\s*[:=]\\s*['"][^'"]{8,}['"]/i,
        /sk_live_[a-zA-Z0-9]+/,
        /sk_test_[a-zA-Z0-9]+/,
      ];
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          return 'Possible hardcoded secret detected - use environment variables';
        }
      }
      return null;
    }
  },
  {
    name: 'Hardcoded URLs',
    test: (content, file) => {
      // Skip test files
      if (file.includes('.test.') || file.includes('/tests/')) return null;
      if (content.includes('localhost:') && !content.includes('process.env') && !content.includes('|| \\'http://localhost')) {
        return 'Hardcoded localhost URL - use environment variable with fallback';
      }
      return null;
    }
  },
  {
    name: 'SQL Injection Risk',
    test: (content, file) => {
      // Check for string concatenation in SQL
      const sqlPatterns = [
        /\\$\\{.*\\}.*(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)/i,
        /['"]\\s*\\+\\s*.*\\+\\s*['"].*(?:SELECT|INSERT|UPDATE|DELETE)/i,
        /sql\\s*\\(\\s*\`[^\\)]*\\$\\{/,
      ];
      for (const pattern of sqlPatterns) {
        if (pattern.test(content)) {
          return 'Possible SQL injection - use parameterized queries';
        }
      }
      return null;
    }
  },
  {
    name: 'Untyped Function Parameters',
    test: (content, file) => {
      if (!file.endsWith('.ts') && !file.endsWith('.tsx')) return null;
      // Check for functions with 'any' type
      if (content.includes(': any)') || content.includes(': any,') || content.includes(': any =')) {
        return 'Using "any" type - provide proper TypeScript types';
      }
      return null;
    }
  },
  {
    name: 'Missing Async Error Handling',
    test: (content, file) => {
      // Check for await without try/catch in the same function scope
      const asyncFunctions = content.match(/async\\s+(?:function\\s+)?\\w*\\s*\\([^)]*\\)\\s*(?::\\s*[^{]+)?\\s*\\{[^}]+\\}/g) || [];
      for (const func of asyncFunctions) {
        if (func.includes('await') && !func.includes('try') && !func.includes('catch')) {
          // Check if it's wrapped in a try/catch at a higher level
          if (!content.includes('.catch(') && !content.includes('try {')) {
            return 'Async function with await but no error handling';
          }
        }
      }
      return null;
    }
  },
  {
    name: 'Empty Catch Block',
    test: (content, file) => {
      if (/catch\\s*\\([^)]*\\)\\s*\\{\\s*\\}/.test(content)) {
        return 'Empty catch block - handle or rethrow errors';
      }
      if (/catch\\s*\\([^)]*\\)\\s*\\{\\s*\\/\\//.test(content)) {
        return 'Catch block with only comment - properly handle errors';
      }
      return null;
    }
  },
  {
    name: 'Direct DOM Manipulation in React',
    test: (content, file) => {
      if (!file.endsWith('.tsx') && !file.endsWith('.jsx')) return null;
      if (content.includes('document.getElementById') ||
          content.includes('document.querySelector') ||
          content.includes('document.createElement')) {
        return 'Direct DOM manipulation in React - use refs or state instead';
      }
      return null;
    }
  },
  {
    name: 'Missing Return Type',
    test: (content, file) => {
      if (!file.endsWith('.ts') && !file.endsWith('.tsx')) return null;
      // Check exported functions without return types
      const exportedFunctions = content.match(/export\\s+(?:async\\s+)?function\\s+\\w+\\s*\\([^)]*\\)\\s*\\{/g) || [];
      for (const func of exportedFunctions) {
        if (!func.includes(':') || func.match(/\\)\\s*\\{$/)) {
          return 'Exported function missing return type annotation';
        }
      }
      return null;
    }
  },
  {
    name: 'Unsafe JSON Parse',
    test: (content, file) => {
      if (content.includes('JSON.parse(') && !content.includes('try') && !content.includes('catch')) {
        return 'JSON.parse without try/catch - can throw on invalid JSON';
      }
      return null;
    }
  },
  {
    name: 'Missing Auth Check',
    test: (content, file) => {
      if (!file.includes('/api/') && !file.includes('route.ts')) return null;
      // Skip public routes
      if (file.includes('/public/') || file.includes('/auth/') || file.includes('/webhook')) return null;
      // Check if it's accessing user data without auth
      if ((content.includes('userId') || content.includes('user.id') || content.includes('session')) &&
          !content.includes('getServerSession') &&
          !content.includes('auth(') &&
          !content.includes('requireAuth') &&
          !content.includes('verifyToken') &&
          !content.includes('validateSession')) {
        return 'Route accesses user data but may be missing auth check';
      }
      return null;
    }
  },
  {
    name: 'Unhandled Promise',
    test: (content, file) => {
      // Check for promises without await or .then/.catch
      const lines = content.split('\\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Skip if line ends with await, .then, .catch, or is assigned
        if (line.match(/(?:fetch|axios|db\\.|prisma\\.).*\\(/) &&
            !line.includes('await') &&
            !line.includes('.then') &&
            !line.includes('.catch') &&
            !line.includes('return') &&
            !line.includes('=')) {
          return \`Unhandled promise at line \${i + 1}\`;
        }
      }
      return null;
    }
  },
  {
    name: 'Sensitive Data in Logs',
    test: (content, file) => {
      const sensitivePatterns = [
        /console\\.log.*password/i,
        /console\\.log.*token/i,
        /console\\.log.*secret/i,
        /console\\.log.*apiKey/i,
        /console\\.log.*creditCard/i,
        /console\\.log.*ssn/i,
      ];
      for (const pattern of sensitivePatterns) {
        if (pattern.test(content)) {
          return 'Possible sensitive data being logged';
        }
      }
      return null;
    }
  }
];

async function validateCode() {
  const cwd = process.cwd();
  const violations = [];
  const warnings = [];

  // Get staged files
  const stagedFiles = getStagedFiles();

  if (stagedFiles.length === 0) {
    return { valid: true, message: 'No code files staged' };
  }

  log(CYAN, '\\n🍪 CodeBakers Pre-Commit Checks');
  log(CYAN, '================================\\n');

  log(DIM, \`📋 Step 1/2: Checking pattern compliance...\\n\`);
  log(DIM, \`🔍 Validating CodeBakers pattern compliance...\\n\`);

  let filesChecked = 0;

  for (const file of stagedFiles) {
    const filePath = path.join(cwd, file);
    if (!fs.existsSync(filePath)) continue;

    let content;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    filesChecked++;
    const fileViolations = [];

    for (const check of CHECKS) {
      const result = check.test(content, file);
      if (result) {
        fileViolations.push({
          check: check.name,
          message: result,
          file: file
        });
      }
    }

    if (fileViolations.length > 0) {
      violations.push(...fileViolations);
    }
  }

  if (filesChecked === 0) {
    log(DIM, 'No files to validate.\\n');
  }

  // Report results
  if (violations.length > 0) {
    log(RED, \`\\n❌ Found \${violations.length} violation(s):\\n\`);

    const byFile = {};
    for (const v of violations) {
      if (!byFile[v.file]) byFile[v.file] = [];
      byFile[v.file].push(v);
    }

    for (const [file, fileViolations] of Object.entries(byFile)) {
      log(YELLOW, \`  \${file}:\`);
      for (const v of fileViolations) {
        log(RED, \`    ✗ [\${v.check}] \${v.message}\`);
      }
      console.log('');
    }

    log(CYAN, '\\nHow to fix:');
    log(RESET, '  1. Address each violation listed above');
    log(RESET, '  2. Re-stage your changes: git add <files>');
    log(RESET, '  3. Try committing again\\n');
    log(YELLOW, 'To bypass (not recommended): git commit --no-verify\\n');

    return { valid: false, violations };
  }

  log(GREEN, '✅ Pattern compliance passed!\\n');

  // Step 2: Run tests if available
  log(DIM, '🧪 Step 2/2: Running tests...\\n');

  try {
    // Check if there's a test script
    const pkgPath = path.join(cwd, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.scripts && pkg.scripts.test) {
        execSync('npm test', { stdio: 'inherit', cwd });
        log(GREEN, '✅ Tests passed!\\n');
      } else {
        log(DIM, 'No test script found, skipping...\\n');
      }
    }
  } catch (error) {
    log(RED, '❌ Tests failed!\\n');
    log(YELLOW, 'Fix failing tests before committing.\\n');
    return { valid: false, reason: 'tests-failed' };
  }

  log(GREEN, '================================');
  log(GREEN, '✅ All pre-commit checks passed!');
  log(GREEN, '================================\\n');

  return { valid: true };
}

async function main() {
  const result = await validateCode();

  if (result.valid) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main().catch(error => {
  log(RED, '  Error: ' + error.message);
  process.exit(1);
});
`;

export async function installPrecommit(): Promise<void> {
  console.log(chalk.blue('\n  CodeBakers Pre-Commit Hook Installation\n'));

  const cwd = process.cwd();

  // Check if this is a git repository
  const gitDir = join(cwd, '.git');
  if (!existsSync(gitDir)) {
    console.log(chalk.red('  ✗ Not a git repository'));
    console.log(chalk.gray('  Initialize git first: git init\n'));
    process.exit(1);
  }

  // Create hooks directory if it doesn't exist
  const hooksDir = join(gitDir, 'hooks');
  if (!existsSync(hooksDir)) {
    mkdirSync(hooksDir, { recursive: true });
  }

  // Write the pre-commit hook
  const preCommitPath = join(hooksDir, 'pre-commit');
  writeFileSync(preCommitPath, PRE_COMMIT_SCRIPT);

  // Make it executable (Unix only, Windows ignores this)
  try {
    chmodSync(preCommitPath, '755');
  } catch {
    // Windows doesn't support chmod
  }

  console.log(chalk.green('  ✓ Created pre-commit hook'));

  // Write the validation script
  const validatePath = join(hooksDir, 'validate-code.js');
  writeFileSync(validatePath, VALIDATE_CODE_SCRIPT);

  console.log(chalk.green('  ✓ Created code validation script'));

  // Check if husky is being used
  const huskyDir = join(cwd, '.husky');
  if (existsSync(huskyDir)) {
    // Also install in husky
    const huskyPreCommit = join(huskyDir, 'pre-commit');
    let huskyContent = '';

    if (existsSync(huskyPreCommit)) {
      huskyContent = readFileSync(huskyPreCommit, 'utf-8');
      if (!huskyContent.includes('validate-code')) {
        huskyContent += '\n# CodeBakers code validation\nnode .git/hooks/validate-code.js\n';
        writeFileSync(huskyPreCommit, huskyContent);
        console.log(chalk.green('  ✓ Added to existing husky pre-commit'));
      } else {
        console.log(chalk.gray('  ✓ Husky hook already configured'));
      }
    } else {
      huskyContent = '#!/usr/bin/env sh\n. "$(dirname -- "$0")/_/husky.sh"\n\n# CodeBakers code validation\nnode .git/hooks/validate-code.js\n';
      writeFileSync(huskyPreCommit, huskyContent);
      try {
        chmodSync(huskyPreCommit, '755');
      } catch {
        // Windows
      }
      console.log(chalk.green('  ✓ Created husky pre-commit hook'));
    }
  }

  console.log(chalk.green('\n  ✅ Pre-commit hook installed!\n'));
  console.log(chalk.cyan('  What this validates:'));
  console.log(chalk.gray('  - API routes have error handling'));
  console.log(chalk.gray('  - Request bodies are validated with Zod'));
  console.log(chalk.gray('  - No console.log statements in production code'));
  console.log(chalk.gray('  - No hardcoded secrets or URLs'));
  console.log(chalk.gray('  - No SQL injection vulnerabilities'));
  console.log(chalk.gray('  - Proper TypeScript types (no "any")'));
  console.log(chalk.gray('  - Async functions have error handling'));
  console.log(chalk.gray('  - No empty catch blocks'));
  console.log(chalk.gray('  - Auth checks on protected routes'));
  console.log(chalk.gray('  - Runs tests before commit\n'));
  console.log(chalk.yellow('  To bypass (not recommended):'));
  console.log(chalk.gray('  git commit --no-verify\n'));
}
