#!/usr/bin/env node
/**
 * CodeBakers Pre-Commit Hook - Session Enforcement
 *
 * This script blocks commits unless a valid CodeBakers session exists.
 * AI must call `discover_patterns` before any code can be committed.
 *
 * Install: Add to .husky/pre-commit or run via `codebakers install-hook`
 */

const fs = require('fs');
const path = require('path');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function log(color, message) {
  console.log(`${color}${message}${RESET}`);
}

async function validateSession() {
  const cwd = process.cwd();
  const stateFile = path.join(cwd, '.codebakers.json');

  // Check if this is a CodeBakers project
  if (!fs.existsSync(stateFile)) {
    // Not a CodeBakers project - allow commit
    return { valid: true, reason: 'not-codebakers-project' };
  }

  let state;
  try {
    state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
  } catch (error) {
    return { valid: false, reason: 'invalid-state-file', error: error.message };
  }

  // Check if v6.0 server-enforced mode
  if (!state.serverEnforced) {
    // Pre-6.0 project - use legacy validation
    return { valid: true, reason: 'legacy-project' };
  }

  // Check for session token
  const sessionToken = state.currentSessionToken;
  if (!sessionToken) {
    return {
      valid: false,
      reason: 'no-session-token',
      message: 'No active CodeBakers session found.\n\nAI must call `discover_patterns` before writing code.'
    };
  }

  // Check session expiry (if stored locally)
  const sessionExpiry = state.sessionExpiresAt;
  if (sessionExpiry && new Date(sessionExpiry) < new Date()) {
    return {
      valid: false,
      reason: 'session-expired',
      message: 'CodeBakers session has expired.\n\nAI must call `discover_patterns` again to start a new session.'
    };
  }

  // Check if validation was completed
  const lastValidation = state.lastValidation;
  if (!lastValidation) {
    return {
      valid: false,
      reason: 'no-validation',
      message: 'No validation completed for this session.\n\nAI must call `validate_complete` before committing.'
    };
  }

  // Check if validation passed
  if (!lastValidation.passed) {
    return {
      valid: false,
      reason: 'validation-failed',
      message: `Validation failed: ${lastValidation.issues?.join(', ') || 'Unknown issues'}\n\nAI must fix issues and call \`validate_complete\` again.`
    };
  }

  // Check if validation is recent (within last 30 minutes)
  const validationTime = new Date(lastValidation.timestamp);
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  if (validationTime < thirtyMinutesAgo) {
    return {
      valid: false,
      reason: 'validation-stale',
      message: 'Validation is stale (older than 30 minutes).\n\nAI must call `validate_complete` again before committing.'
    };
  }

  // Optional: Verify with server (if online)
  const apiUrl = state.apiUrl || 'https://codebakers.ai';
  try {
    const response = await fetch(`${apiUrl}/api/patterns/validate?token=${sessionToken}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (response.ok) {
      const data = await response.json();
      if (!data.valid) {
        return {
          valid: false,
          reason: 'server-rejected',
          message: `Server rejected session: ${data.reason || 'Unknown reason'}`
        };
      }
    }
    // If server check fails, allow commit (offline mode)
  } catch (error) {
    // Server unreachable - allow commit with local validation only
    log(YELLOW, '  ⚠️  Server unreachable - using local validation only');
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
    log(RED, `  ✗ Commit blocked: ${result.reason}`);
    console.log('');
    if (result.message) {
      log(YELLOW, `  ${result.message.split('\n').join('\n  ')}`);
    }
    console.log('');
    log(CYAN, '  How to fix:');
    log(RESET, '  1. AI must call `discover_patterns` before writing code');
    log(RESET, '  2. AI must call `validate_complete` before saying "done"');
    log(RESET, '  3. Both tools must pass for commits to be allowed');
    console.log('');
    log(YELLOW, '  To bypass (not recommended):');
    log(RESET, '  git commit --no-verify');
    console.log('');
    process.exit(1);
  }
}

main().catch(error => {
  log(RED, `  Error: ${error.message}`);
  process.exit(1);
});
