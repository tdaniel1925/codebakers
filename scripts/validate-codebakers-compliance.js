#!/usr/bin/env node
/**
 * CodeBakers Pattern Compliance Validator
 *
 * This script validates that AI-generated code follows CodeBakers patterns.
 * Run as pre-commit hook or in CI to enforce compliance.
 *
 * Checks:
 * 1. Pattern compliance markers in code comments
 * 2. Required code patterns (error handling, types, etc.)
 * 3. Forbidden anti-patterns
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  // Files to validate (glob patterns)
  include: [
    'src/**/*.ts',
    'src/**/*.tsx',
    'app/**/*.ts',
    'app/**/*.tsx',
    'lib/**/*.ts',
    'services/**/*.ts',
    'components/**/*.tsx',
  ],

  // Files to skip
  exclude: [
    'node_modules/**',
    'dist/**',
    '.next/**',
    '**/*.d.ts',
    '**/*.test.ts',
    '**/*.spec.ts',
  ],

  // Minimum lines to trigger validation (skip tiny files)
  minLines: 10,

  // Only validate staged files in pre-commit mode
  stagedOnly: process.argv.includes('--staged'),

  // Strict mode fails on warnings too
  strict: process.argv.includes('--strict'),

  // Verbose mode for debugging
  verbose: process.argv.includes('--verbose'),
};

// Pattern requirements by file type
const PATTERNS = {
  // API routes must have these patterns
  apiRoute: {
    match: /app\/api\/.*\/route\.ts$/,
    required: [
      { pattern: /try\s*\{/, name: 'error-handling', message: 'API routes must have try/catch error handling' },
      { pattern: /NextResponse\.json/, name: 'proper-response', message: 'Use NextResponse.json for responses' },
    ],
    forbidden: [
      { pattern: /console\.log\(/, name: 'no-console-log', message: 'Remove console.log from API routes (use proper logging)' },
      { pattern: /any(?!\w)/, name: 'no-any-type', message: 'Avoid using "any" type - use proper TypeScript types', severity: 'warning' },
    ],
  },

  // React components
  component: {
    match: /components\/.*\.tsx$/,
    required: [
      { pattern: /^['"]use client['"]|^['"]use server['"]|export (default |const |function )/, name: 'valid-component', message: 'Components must be valid React components' },
    ],
    forbidden: [
      { pattern: /document\.(getElementById|querySelector)/, name: 'no-dom-direct', message: 'Use React refs instead of direct DOM manipulation', severity: 'warning' },
    ],
  },

  // Service files
  service: {
    match: /services\/.*\.ts$/,
    required: [
      { pattern: /export (class|const|function|async function)/, name: 'exports', message: 'Services must export functions or classes' },
    ],
    forbidden: [
      { pattern: /throw new Error\(['"]TODO/, name: 'no-todo-throws', message: 'Remove TODO placeholders before committing' },
    ],
  },

  // Database/Drizzle files
  database: {
    match: /(db|database|schema)\/.*\.ts$/,
    required: [],
    forbidden: [
      { pattern: /raw\s*\(|sql\.raw/, name: 'no-raw-sql', message: 'Avoid raw SQL - use Drizzle query builder', severity: 'warning' },
    ],
  },
};

// Universal forbidden patterns (apply to all files)
const UNIVERSAL_FORBIDDEN = [
  { pattern: /process\.env\.[A-Z_]+(?!\s*[!?|&])/, name: 'env-no-fallback', message: 'Environment variables should have fallbacks or type guards', severity: 'warning' },
  { pattern: /\/\/ @ts-ignore/, name: 'no-ts-ignore', message: 'Fix TypeScript errors instead of ignoring them', severity: 'warning' },
  { pattern: /\/\/ @ts-nocheck/, name: 'no-ts-nocheck', message: 'Do not disable TypeScript checking' },
  { pattern: /FIXME:|HACK:|XXX:/, name: 'no-fixme', message: 'Resolve FIXME/HACK/XXX comments before committing', severity: 'warning' },
];

// Compliance marker patterns
const COMPLIANCE_MARKERS = {
  // Look for CodeBakers compliance comment
  pattern: /\/[/*]\s*@codebakers|\/[/*]\s*CodeBakers Pattern:|🍪\s*CodeBakers/,
  required: false, // Set to true to require markers in all files
};

// Results tracking
let errors = [];
let warnings = [];
let filesChecked = 0;
let filesSkipped = 0;

/**
 * Get list of files to validate
 */
function getFilesToValidate() {
  let files = [];

  if (CONFIG.stagedOnly) {
    // Get staged files from git
    try {
      const staged = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf-8' });
      files = staged.split('\n').filter(f => f.trim());
    } catch (e) {
      console.error('Failed to get staged files:', e.message);
      process.exit(1);
    }
  } else {
    // Get all matching files
    const glob = require('glob');
    for (const pattern of CONFIG.include) {
      if (CONFIG.verbose) {
        console.log(`   Searching pattern: ${pattern}`);
      }
      const matches = glob.sync(pattern, { ignore: CONFIG.exclude });
      if (CONFIG.verbose) {
        console.log(`   Found ${matches.length} matches`);
      }
      files.push(...matches);
    }
    if (CONFIG.verbose) {
      console.log(`   Total files before filtering: ${files.length}`);
    }
  }

  // When using glob.sync, files are already filtered by include/exclude
  // For staged files, we need to re-filter
  if (CONFIG.stagedOnly) {
    return files.filter(file => {
      // Normalize path separators
      const normalizedFile = file.replace(/\\/g, '/');
      const included = CONFIG.include.some(p => {
        const regex = new RegExp('^' + p.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\./g, '\\.') + '$');
        return regex.test(normalizedFile);
      });
      const excluded = CONFIG.exclude.some(p => {
        const regex = new RegExp(p.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\./g, '\\.'));
        return regex.test(normalizedFile);
      });
      return included && !excluded;
    });
  }

  // Glob results are already correctly filtered
  return [...new Set(files)]; // Remove duplicates
}

/**
 * Validate a single file
 */
function validateFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Skip small files
  if (lines.length < CONFIG.minLines) {
    filesSkipped++;
    return;
  }

  filesChecked++;
  const fileErrors = [];
  const fileWarnings = [];

  // Check for compliance markers (optional)
  if (COMPLIANCE_MARKERS.required && !COMPLIANCE_MARKERS.pattern.test(content)) {
    fileWarnings.push({
      file: filePath,
      rule: 'compliance-marker',
      message: 'File should include CodeBakers compliance marker comment',
      severity: 'warning',
    });
  }

  // Find matching pattern set
  for (const [name, rules] of Object.entries(PATTERNS)) {
    if (!rules.match.test(filePath)) continue;

    // Check required patterns
    for (const req of rules.required) {
      if (!req.pattern.test(content)) {
        fileErrors.push({
          file: filePath,
          rule: req.name,
          message: req.message,
          severity: 'error',
        });
      }
    }

    // Check forbidden patterns
    for (const forbid of rules.forbidden) {
      const matches = content.match(new RegExp(forbid.pattern, 'g'));
      if (matches) {
        const issue = {
          file: filePath,
          rule: forbid.name,
          message: `${forbid.message} (found ${matches.length} occurrence${matches.length > 1 ? 's' : ''})`,
          severity: forbid.severity || 'error',
        };
        if (issue.severity === 'warning') {
          fileWarnings.push(issue);
        } else {
          fileErrors.push(issue);
        }
      }
    }
  }

  // Check universal forbidden patterns
  for (const forbid of UNIVERSAL_FORBIDDEN) {
    const matches = content.match(new RegExp(forbid.pattern, 'g'));
    if (matches) {
      const issue = {
        file: filePath,
        rule: forbid.name,
        message: `${forbid.message} (found ${matches.length} occurrence${matches.length > 1 ? 's' : ''})`,
        severity: forbid.severity || 'error',
      };
      if (issue.severity === 'warning') {
        fileWarnings.push(issue);
      } else {
        fileErrors.push(issue);
      }
    }
  }

  errors.push(...fileErrors);
  warnings.push(...fileWarnings);
}

/**
 * Print results
 */
function printResults() {
  console.log('\n🍪 CodeBakers Pattern Compliance Check\n');
  console.log(`   Files checked: ${filesChecked}`);
  console.log(`   Files skipped: ${filesSkipped} (too small)`);
  console.log('');

  if (warnings.length > 0) {
    console.log(`⚠️  Warnings (${warnings.length}):\n`);
    for (const warn of warnings) {
      console.log(`   ${warn.file}`);
      console.log(`   └─ [${warn.rule}] ${warn.message}\n`);
    }
  }

  if (errors.length > 0) {
    console.log(`❌ Errors (${errors.length}):\n`);
    for (const err of errors) {
      console.log(`   ${err.file}`);
      console.log(`   └─ [${err.rule}] ${err.message}\n`);
    }
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ All files comply with CodeBakers patterns!\n');
  }
}

/**
 * Main
 */
function main() {
  console.log('🔍 Validating CodeBakers pattern compliance...\n');

  const files = getFilesToValidate();

  if (files.length === 0) {
    console.log('No files to validate.\n');
    process.exit(0);
  }

  for (const file of files) {
    validateFile(file);
  }

  printResults();

  // Exit with error code if issues found
  if (errors.length > 0) {
    console.log('❌ Commit blocked: Fix the errors above to proceed.\n');
    console.log('   These patterns are required by CodeBakers for production-quality code.');
    console.log('   See .claude/ pattern files for correct implementations.\n');
    process.exit(1);
  }

  if (CONFIG.strict && warnings.length > 0) {
    console.log('⚠️  Commit blocked (strict mode): Fix warnings to proceed.\n');
    process.exit(1);
  }

  process.exit(0);
}

main();
