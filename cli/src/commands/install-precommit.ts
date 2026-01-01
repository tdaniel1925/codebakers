import chalk from 'chalk';
import { existsSync, mkdirSync, writeFileSync, chmodSync, readFileSync } from 'fs';
import { join } from 'path';

const PRE_COMMIT_SCRIPT = `#!/bin/sh
# CodeBakers Pre-Commit Hook - Session Enforcement
# Blocks commits unless AI called discover_patterns and validate_complete

# Run the validation script
node "$(dirname "$0")/validate-session.js"
exit $?
`;

const VALIDATE_SESSION_SCRIPT = `#!/usr/bin/env node
/**
 * CodeBakers Pre-Commit Validation
 * Blocks commits unless a valid session exists
 */

const fs = require('fs');
const path = require('path');

const RED = '\\x1b[31m';
const GREEN = '\\x1b[32m';
const YELLOW = '\\x1b[33m';
const CYAN = '\\x1b[36m';
const RESET = '\\x1b[0m';

function log(color, message) {
  console.log(color + message + RESET);
}

async function validateSession() {
  const cwd = process.cwd();
  const stateFile = path.join(cwd, '.codebakers.json');

  // Check if this is a CodeBakers project
  if (!fs.existsSync(stateFile)) {
    return { valid: true, reason: 'not-codebakers-project' };
  }

  let state;
  try {
    state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
  } catch (error) {
    return { valid: false, reason: 'invalid-state-file' };
  }

  // Check if v6.0 server-enforced mode
  if (!state.serverEnforced) {
    return { valid: true, reason: 'legacy-project' };
  }

  // Check for session token (means discover_patterns was called)
  const sessionToken = state.currentSessionToken;
  if (!sessionToken) {
    // Check if there's a recent passed validation
    const lastValidation = state.lastValidation;
    if (!lastValidation || !lastValidation.passed) {
      return {
        valid: false,
        reason: 'no-session',
        message: 'No active CodeBakers session.\\nAI must call discover_patterns before writing code.'
      };
    }
  }

  // Check session expiry
  const sessionExpiry = state.sessionExpiresAt;
  if (sessionExpiry && new Date(sessionExpiry) < new Date()) {
    return {
      valid: false,
      reason: 'session-expired',
      message: 'CodeBakers session has expired.\\nAI must call discover_patterns again.'
    };
  }

  // Check if validation was completed
  const lastValidation = state.lastValidation;
  if (!lastValidation) {
    return {
      valid: false,
      reason: 'no-validation',
      message: 'No validation completed.\\nAI must call validate_complete before committing.'
    };
  }

  // Check if validation passed
  if (!lastValidation.passed) {
    const issues = lastValidation.issues?.map(i => i.message || i).join(', ') || 'Unknown issues';
    return {
      valid: false,
      reason: 'validation-failed',
      message: 'Validation failed: ' + issues + '\\nAI must fix issues and call validate_complete again.'
    };
  }

  // Check if validation is recent (within last 30 minutes)
  const validationTime = new Date(lastValidation.timestamp);
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  if (validationTime < thirtyMinutesAgo) {
    return {
      valid: false,
      reason: 'validation-stale',
      message: 'Validation is stale (older than 30 minutes).\\nAI must call validate_complete again.'
    };
  }

  return { valid: true, reason: 'session-valid' };
}

async function main() {
  console.log('');
  log(CYAN, '  🍪 CodeBakers Pre-Commit Validation');
  console.log('');

  const result = await validateSession();

  if (result.valid) {
    if (result.reason === 'not-codebakers-project') {
      log(GREEN, '  ✓ Not a CodeBakers project - commit allowed');
    } else if (result.reason === 'legacy-project') {
      log(GREEN, '  ✓ Legacy project (pre-6.0) - commit allowed');
    } else {
      log(GREEN, '  ✓ Valid CodeBakers session - commit allowed');
    }
    console.log('');
    process.exit(0);
  } else {
    log(RED, '  ✗ Commit blocked: ' + result.reason);
    console.log('');
    if (result.message) {
      log(YELLOW, '  ' + result.message.split('\\n').join('\\n  '));
    }
    console.log('');
    log(CYAN, '  How to fix:');
    log(RESET, '  1. AI must call discover_patterns before writing code');
    log(RESET, '  2. AI must call validate_complete before saying "done"');
    log(RESET, '  3. Both tools must pass for commits to be allowed');
    console.log('');
    log(YELLOW, '  To bypass (not recommended): git commit --no-verify');
    console.log('');
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

  // Check if this is a CodeBakers project
  const stateFile = join(cwd, '.codebakers.json');
  if (!existsSync(stateFile)) {
    console.log(chalk.yellow('  ⚠️  No .codebakers.json found'));
    console.log(chalk.gray('  Run codebakers upgrade first to enable server enforcement\n'));
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
  const validatePath = join(hooksDir, 'validate-session.js');
  writeFileSync(validatePath, VALIDATE_SESSION_SCRIPT);

  console.log(chalk.green('  ✓ Created validation script'));

  // Check if husky is being used
  const huskyDir = join(cwd, '.husky');
  if (existsSync(huskyDir)) {
    // Also install in husky
    const huskyPreCommit = join(huskyDir, 'pre-commit');
    let huskyContent = '';

    if (existsSync(huskyPreCommit)) {
      huskyContent = readFileSync(huskyPreCommit, 'utf-8');
      if (!huskyContent.includes('validate-session')) {
        huskyContent += '\n# CodeBakers session enforcement\nnode .git/hooks/validate-session.js\n';
        writeFileSync(huskyPreCommit, huskyContent);
        console.log(chalk.green('  ✓ Added to existing husky pre-commit'));
      } else {
        console.log(chalk.gray('  ✓ Husky hook already configured'));
      }
    } else {
      huskyContent = '#!/usr/bin/env sh\n. "$(dirname -- "$0")/_/husky.sh"\n\n# CodeBakers session enforcement\nnode .git/hooks/validate-session.js\n';
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
  console.log(chalk.cyan('  What this does:'));
  console.log(chalk.gray('  - Blocks commits unless AI called discover_patterns'));
  console.log(chalk.gray('  - Blocks commits unless AI called validate_complete'));
  console.log(chalk.gray('  - Requires validation to pass before committing'));
  console.log(chalk.gray('  - Validation expires after 30 minutes\n'));
  console.log(chalk.yellow('  To bypass (not recommended):'));
  console.log(chalk.gray('  git commit --no-verify\n'));
}
