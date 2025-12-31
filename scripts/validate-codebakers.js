#!/usr/bin/env node

/**
 * CodeBakers Pre-Commit Validation
 *
 * This script validates staged files against CodeBakers patterns before commit.
 * It blocks commits that violate critical rules.
 *
 * Install: npm run prepare (adds to husky pre-commit)
 * Manual: node scripts/validate-codebakers.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for output
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

// Get staged files
function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf-8',
    });
    return output.trim().split('\n').filter(f => f.length > 0);
  } catch {
    return [];
  }
}

// Check for test files
function hasTestsForFile(file) {
  const testVariants = [
    file.replace(/\.tsx?$/, '.test.ts'),
    file.replace(/\.tsx?$/, '.test.tsx'),
    file.replace(/\.tsx?$/, '.spec.ts'),
    file.replace(/\.tsx?$/, '.spec.tsx'),
    file.replace(/^src\//, 'tests/').replace(/\.tsx?$/, '.test.ts'),
    file.replace(/^src\//, 'tests/').replace(/\.tsx?$/, '.spec.ts'),
  ];

  return testVariants.some(testFile => fs.existsSync(testFile));
}

// Validate a single file
function validateFile(filePath) {
  const errors = [];
  const warnings = [];

  if (!fs.existsSync(filePath)) return { errors, warnings };

  const content = fs.readFileSync(filePath, 'utf-8');
  const isApiRoute = filePath.includes('/api/') && filePath.endsWith('route.ts');
  const isComponent = filePath.endsWith('.tsx') && !filePath.includes('.test.');
  const isService = filePath.includes('/services/') && filePath.endsWith('.ts');

  // Universal rules
  if (content.includes('@ts-ignore') || content.includes('@ts-nocheck')) {
    errors.push('Contains @ts-ignore or @ts-nocheck - remove these');
  }

  if (content.includes('FIXME:') || content.includes('HACK:') || content.includes('XXX:')) {
    errors.push('Contains FIXME/HACK/XXX comments - fix these before committing');
  }

  // Check for hardcoded secrets patterns
  const secretPatterns = [
    /sk-[a-zA-Z0-9]{20,}/, // OpenAI
    /sk_live_[a-zA-Z0-9]+/, // Stripe live
    /ghp_[a-zA-Z0-9]{36}/, // GitHub
    /AKIA[A-Z0-9]{16}/, // AWS
  ];
  for (const pattern of secretPatterns) {
    if (pattern.test(content)) {
      errors.push('Possible hardcoded secret detected - use environment variables');
      break;
    }
  }

  // API Route rules
  if (isApiRoute) {
    if (!content.includes('try') || !content.includes('catch')) {
      errors.push('API route missing try/catch error handling');
    }
    if (content.includes('console.log(')) {
      warnings.push('API route contains console.log - remove before production');
    }
  }

  // Component rules
  if (isComponent) {
    if (content.includes('document.') && !content.includes('useEffect')) {
      warnings.push('Direct DOM manipulation detected - prefer React patterns');
    }
  }

  // Check for any type abuse
  const anyCount = (content.match(/:\s*any\b/g) || []).length;
  if (anyCount > 3) {
    warnings.push(`Contains ${anyCount} uses of 'any' type - consider proper typing`);
  }

  return { errors, warnings };
}

// Main validation
function main() {
  const stagedFiles = getStagedFiles();
  const tsFiles = stagedFiles.filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));

  if (tsFiles.length === 0) {
    console.log(`${GREEN}No TypeScript files staged - skipping validation${RESET}`);
    process.exit(0);
  }

  console.log(`\n${YELLOW}CodeBakers Pre-Commit Validation${RESET}\n`);
  console.log(`Checking ${tsFiles.length} TypeScript file(s)...\n`);

  let hasErrors = false;
  let hasWarnings = false;

  for (const file of tsFiles) {
    const { errors, warnings } = validateFile(file);

    if (errors.length > 0 || warnings.length > 0) {
      console.log(`${file}:`);

      for (const error of errors) {
        console.log(`  ${RED}ERROR: ${error}${RESET}`);
        hasErrors = true;
      }

      for (const warning of warnings) {
        console.log(`  ${YELLOW}WARN: ${warning}${RESET}`);
        hasWarnings = true;
      }

      console.log('');
    }
  }

  // Check for test coverage on new/modified source files
  const sourceFiles = tsFiles.filter(f =>
    !f.includes('.test.') &&
    !f.includes('.spec.') &&
    !f.includes('/tests/') &&
    (f.startsWith('src/') || f.startsWith('app/'))
  );

  const filesWithoutTests = sourceFiles.filter(f => !hasTestsForFile(f));
  if (filesWithoutTests.length > 0) {
    console.log(`${YELLOW}Files without tests:${RESET}`);
    for (const file of filesWithoutTests) {
      console.log(`  ${YELLOW}- ${file}${RESET}`);
    }
    console.log(`\n${YELLOW}Consider adding tests for these files.${RESET}\n`);
    // Note: This is a warning, not a blocking error (for now)
  }

  // Summary
  if (hasErrors) {
    console.log(`\n${RED}COMMIT BLOCKED: Fix the errors above before committing.${RESET}\n`);
    process.exit(1);
  } else if (hasWarnings) {
    console.log(`\n${YELLOW}Commit allowed with warnings. Consider fixing them.${RESET}\n`);
    process.exit(0);
  } else {
    console.log(`${GREEN}All checks passed!${RESET}\n`);
    process.exit(0);
  }
}

main();
