import chalk from 'chalk';
import ora from 'ora';
import { existsSync, writeFileSync, mkdirSync, readFileSync, rmSync, readdirSync, copyFileSync, chmodSync } from 'fs';
import { join } from 'path';
import { getApiKey, getApiUrl } from '../config.js';
import { checkForUpdates, getCliVersion } from '../lib/api.js';

// Pre-commit hook script for session enforcement
const PRE_COMMIT_SCRIPT = `#!/bin/sh
# CodeBakers Pre-Commit Hook - Session Enforcement
# Blocks commits unless AI called discover_patterns and validate_complete
node "$(dirname "$0")/validate-session.js"
exit $?
`;

const VALIDATE_SESSION_SCRIPT = `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const RED = '\\x1b[31m', GREEN = '\\x1b[32m', YELLOW = '\\x1b[33m', CYAN = '\\x1b[36m', RESET = '\\x1b[0m';
function log(c, m) { console.log(c + m + RESET); }

async function validate() {
  const stateFile = path.join(process.cwd(), '.codebakers.json');
  if (!fs.existsSync(stateFile)) return { valid: true, reason: 'not-codebakers' };

  let state;
  try { state = JSON.parse(fs.readFileSync(stateFile, 'utf-8')); }
  catch { return { valid: false, reason: 'invalid-state' }; }

  if (!state.serverEnforced) return { valid: true, reason: 'legacy' };

  const v = state.lastValidation;
  if (!v) return { valid: false, reason: 'no-validation', msg: 'AI must call validate_complete before commit' };
  if (!v.passed) return { valid: false, reason: 'failed', msg: 'Validation failed - fix issues first' };

  const age = Date.now() - new Date(v.timestamp).getTime();
  if (age > 30 * 60 * 1000) return { valid: false, reason: 'stale', msg: 'Validation expired - call validate_complete again' };

  return { valid: true, reason: 'ok' };
}

async function main() {
  console.log(''); log(CYAN, '  🍪 CodeBakers Pre-Commit');
  const r = await validate();
  if (r.valid) { log(GREEN, '  ✓ Commit allowed'); console.log(''); process.exit(0); }
  else { log(RED, '  ✗ Blocked: ' + r.reason); if (r.msg) log(YELLOW, '  ' + r.msg);
    console.log(''); log(YELLOW, '  Bypass: git commit --no-verify'); console.log(''); process.exit(1); }
}
main().catch(e => { log(RED, '  Error: ' + e.message); process.exit(1); });
`;

/**
 * Install pre-commit hook for session enforcement
 */
function installPrecommitHook(cwd: string): void {
  const gitDir = join(cwd, '.git');
  if (!existsSync(gitDir)) {
    console.log(chalk.gray('  ⏭️  Skipping pre-commit hook (not a git repo)'));
    return;
  }

  const hooksDir = join(gitDir, 'hooks');
  if (!existsSync(hooksDir)) {
    mkdirSync(hooksDir, { recursive: true });
  }

  // Write pre-commit hook
  const preCommitPath = join(hooksDir, 'pre-commit');
  writeFileSync(preCommitPath, PRE_COMMIT_SCRIPT);
  try { chmodSync(preCommitPath, '755'); } catch { /* Windows */ }

  // Write validation script
  const validatePath = join(hooksDir, 'validate-session.js');
  writeFileSync(validatePath, VALIDATE_SESSION_SCRIPT);

  console.log(chalk.green('  ✓ Installed pre-commit hook (blocks commits without validation)'));
}

interface ContentResponse {
  version: string;
  router: string;
  modules: Record<string, string>;
}

// Ultra-minimal CLAUDE.md for v6.0 - ALL instructions come from server
const MINIMAL_CLAUDE_MD = `# CodeBakers v6.0

**MANDATORY: Before writing ANY code, call the \`discover_patterns\` MCP tool.**

\`\`\`
Tool: discover_patterns
Args: { task: "description of what you're building" }
\`\`\`

The server will return:
- All coding patterns and rules you must follow
- Test requirements
- Validation instructions

**You cannot write code without calling this tool first. The server tracks compliance.**

---
*CodeBakers v6.0 - Server-Enforced*
`;

// Ultra-minimal .cursorrules for v6.0 - ALL instructions come from server
const MINIMAL_CURSORRULES = `# CodeBakers v6.0

MANDATORY: Before writing ANY code, call the discover_patterns MCP tool.

Tool: discover_patterns
Args: { task: "description of what you're building" }

The server returns all patterns, rules, and test requirements.
You cannot write code without calling this tool first.
`;

/**
 * Compare semantic versions (returns true if v1 < v2)
 */
function isVersionLessThan(v1: string, v2: string): boolean {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 < p2) return true;
    if (p1 > p2) return false;
  }
  return false;
}

interface ConfirmData {
  version: string;
  moduleCount: number;
  cliVersion: string;
  command: string;
  projectName?: string;
}

/**
 * Confirm download to server (non-blocking, fire-and-forget)
 */
async function confirmDownload(apiUrl: string, apiKey: string, data: ConfirmData): Promise<void> {
  try {
    await fetch(`${apiUrl}/api/content/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(data),
    });
  } catch {
    // Silently ignore - this is just for analytics
  }
}

/**
 * Get current installed version from .claude/.version.json
 */
function getCurrentVersion(cwd: string): string | null {
  const versionFile = join(cwd, '.claude', '.version.json');
  const codebakersFile = join(cwd, '.codebakers.json');

  try {
    if (existsSync(versionFile)) {
      const data = JSON.parse(readFileSync(versionFile, 'utf-8'));
      return data.version || null;
    }
    if (existsSync(codebakersFile)) {
      const data = JSON.parse(readFileSync(codebakersFile, 'utf-8'));
      return data.version || null;
    }
  } catch {
    // Ignore errors
  }
  return null;
}

/**
 * Backup old files before migration
 */
function backupOldFiles(cwd: string): void {
  const backupDir = join(cwd, '.codebakers', 'backup', new Date().toISOString().replace(/[:.]/g, '-'));
  mkdirSync(backupDir, { recursive: true });

  // Backup CLAUDE.md
  const claudeMd = join(cwd, 'CLAUDE.md');
  if (existsSync(claudeMd)) {
    copyFileSync(claudeMd, join(backupDir, 'CLAUDE.md'));
  }

  // Backup .cursorrules
  const cursorrules = join(cwd, '.cursorrules');
  if (existsSync(cursorrules)) {
    copyFileSync(cursorrules, join(backupDir, '.cursorrules'));
  }

  // Backup .claude folder
  const claudeDir = join(cwd, '.claude');
  if (existsSync(claudeDir)) {
    const claudeBackup = join(backupDir, '.claude');
    mkdirSync(claudeBackup, { recursive: true });
    const files = readdirSync(claudeDir);
    for (const file of files) {
      const src = join(claudeDir, file);
      const dest = join(claudeBackup, file);
      try {
        copyFileSync(src, dest);
      } catch {
        // Ignore copy errors
      }
    }
  }

  console.log(chalk.gray(`  Backup saved to: ${backupDir}`));
}

/**
 * Migrate to v6.0 server-enforced patterns
 */
function migrateToV6(cwd: string): void {
  console.log(chalk.yellow('\n  📦 Migrating to v6.0 Server-Enforced Patterns...\n'));

  // Backup old files
  console.log(chalk.gray('  Backing up old files...'));
  backupOldFiles(cwd);

  // Replace CLAUDE.md with minimal version
  const claudeMd = join(cwd, 'CLAUDE.md');
  writeFileSync(claudeMd, MINIMAL_CLAUDE_MD);
  console.log(chalk.green('  ✓ Updated CLAUDE.md (minimal server-enforced version)'));

  // Replace .cursorrules with minimal version
  const cursorrules = join(cwd, '.cursorrules');
  writeFileSync(cursorrules, MINIMAL_CURSORRULES);
  console.log(chalk.green('  ✓ Updated .cursorrules (minimal server-enforced version)'));

  // Delete .claude folder (patterns now come from server)
  const claudeDir = join(cwd, '.claude');
  if (existsSync(claudeDir)) {
    try {
      rmSync(claudeDir, { recursive: true, force: true });
      console.log(chalk.green('  ✓ Removed .claude/ folder (patterns now server-side)'));
    } catch (error) {
      console.log(chalk.yellow('  ⚠️  Could not remove .claude/ folder - please delete manually'));
    }
  }

  // Create .codebakers directory if it doesn't exist
  const codebakersDir = join(cwd, '.codebakers');
  if (!existsSync(codebakersDir)) {
    mkdirSync(codebakersDir, { recursive: true });
  }

  // Update version in .codebakers.json
  const stateFile = join(cwd, '.codebakers.json');
  let state: Record<string, unknown> = {};
  if (existsSync(stateFile)) {
    try {
      state = JSON.parse(readFileSync(stateFile, 'utf-8'));
    } catch {
      // Ignore errors
    }
  }
  state.version = '6.0';
  state.migratedAt = new Date().toISOString();
  state.serverEnforced = true;
  writeFileSync(stateFile, JSON.stringify(state, null, 2));

  // Auto-install pre-commit hook for enforcement
  installPrecommitHook(cwd);

  console.log(chalk.green('\n  ✅ Migration to v6.0 complete!\n'));
  console.log(chalk.cyan('  What changed:'));
  console.log(chalk.gray('  - Patterns are now fetched from server in real-time'));
  console.log(chalk.gray('  - discover_patterns creates a server-tracked session'));
  console.log(chalk.gray('  - validate_complete verifies with server before completion'));
  console.log(chalk.gray('  - Pre-commit hook blocks commits without validation'));
  console.log(chalk.gray('  - No local pattern files needed\n'));
}

/**
 * Upgrade CodeBakers patterns to the latest version
 */
export async function upgrade(): Promise<void> {
  console.log(chalk.blue('\n  CodeBakers Upgrade\n'));

  const cwd = process.cwd();
  const claudeMdPath = join(cwd, 'CLAUDE.md');
  const claudeDir = join(cwd, '.claude');
  const codebakersJson = join(cwd, '.codebakers.json');

  // Check if this is a CodeBakers project
  if (!existsSync(claudeMdPath) && !existsSync(claudeDir) && !existsSync(codebakersJson)) {
    console.log(chalk.yellow('  No CodeBakers installation found in this directory.\n'));
    console.log(chalk.gray('  Run `codebakers install` to set up patterns first.\n'));
    return;
  }

  // Check for CLI updates
  console.log(chalk.gray('  Checking for CLI updates...\n'));
  const updateInfo = await checkForUpdates();

  if (updateInfo?.updateAvailable) {
    console.log(chalk.yellow(`  ⚠️  CLI update available: ${updateInfo.currentVersion} → ${updateInfo.latestVersion}`));
    console.log(chalk.gray('  Run: npm install -g @codebakers/cli@latest\n'));
  } else {
    console.log(chalk.green(`  ✓ CLI is up to date (v${getCliVersion()})\n`));
  }

  // Check API key
  const apiKey = getApiKey();
  if (!apiKey) {
    console.log(chalk.yellow('  Not logged in. Run `codebakers setup` first.\n'));
    return;
  }

  // Check current version and determine if migration is needed
  const currentVersion = getCurrentVersion(cwd);
  const spinner = ora('Checking server for latest version...').start();

  try {
    const apiUrl = getApiUrl();

    // Check latest version from server
    const versionResponse = await fetch(`${apiUrl}/api/content/version`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!versionResponse.ok) {
      throw new Error('Failed to check version');
    }

    const versionData = await versionResponse.json();
    const latestVersion = versionData.version;

    spinner.succeed(`Latest version: v${latestVersion}`);

    // Check if we need to migrate to v6.0
    const needsV6Migration = currentVersion && isVersionLessThan(currentVersion, '6.0') &&
                             !isVersionLessThan(latestVersion, '6.0');

    if (needsV6Migration || (!currentVersion && !isVersionLessThan(latestVersion, '6.0'))) {
      // Need to migrate to v6.0 server-enforced patterns
      migrateToV6(cwd);

      // Confirm migration to server
      confirmDownload(apiUrl, apiKey, {
        version: '6.0',
        moduleCount: 0, // No local modules in v6
        cliVersion: getCliVersion(),
        command: 'upgrade-v6-migration',
      }).catch(() => {});

      return;
    }

    // For v6.0+, just confirm the installation is up to date
    const stateFile = join(cwd, '.codebakers.json');
    let state: Record<string, unknown> = {};
    if (existsSync(stateFile)) {
      try {
        state = JSON.parse(readFileSync(stateFile, 'utf-8'));
      } catch {
        // Ignore
      }
    }

    if (state.serverEnforced) {
      // Already on v6.0+ server-enforced mode
      console.log(chalk.green('\n  ✅ Already using v6.0 server-enforced patterns!\n'));
      console.log(chalk.gray('  Patterns are fetched from server in real-time.'));
      console.log(chalk.gray('  No local updates needed.\n'));
      return;
    }

    // Legacy upgrade for pre-6.0 versions (fetch full content)
    const contentSpinner = ora('Fetching latest patterns...').start();

    const response = await fetch(`${apiUrl}/api/content`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to fetch patterns');
    }

    const content: ContentResponse = await response.json();

    contentSpinner.succeed(`Patterns v${content.version} downloaded`);

    // Count what we're updating
    const moduleCount = Object.keys(content.modules).length;

    console.log(chalk.gray(`  Updating ${moduleCount} modules...\n`));

    // Update CLAUDE.md
    if (content.router) {
      writeFileSync(claudeMdPath, content.router);
      console.log(chalk.green('  ✓ Updated CLAUDE.md'));
    }

    // Update pattern modules
    if (content.modules && Object.keys(content.modules).length > 0) {
      if (!existsSync(claudeDir)) {
        mkdirSync(claudeDir, { recursive: true });
      }

      for (const [name, data] of Object.entries(content.modules)) {
        writeFileSync(join(claudeDir, name), data);
      }

      console.log(chalk.green(`  ✓ Updated ${moduleCount} modules in .claude/`));
    }

    // Write version file for tracking
    const versionInfo = {
      version: content.version,
      moduleCount,
      updatedAt: new Date().toISOString(),
      cliVersion: getCliVersion(),
    };

    if (!existsSync(claudeDir)) {
      mkdirSync(claudeDir, { recursive: true });
    }
    writeFileSync(join(claudeDir, '.version.json'), JSON.stringify(versionInfo, null, 2));
    console.log(chalk.green('  ✓ Version info saved'));

    // Confirm download to server (non-blocking)
    confirmDownload(apiUrl, apiKey, {
      version: content.version,
      moduleCount,
      cliVersion: getCliVersion(),
      command: 'upgrade',
    }).catch(() => {}); // Silently ignore confirmation failures

    console.log(chalk.green(`\n  ✅ Upgraded to patterns v${content.version}!\n`));

    // Show what's new if available
    console.log(chalk.gray('  Changes take effect in your next AI session.\n'));

  } catch (error) {
    spinner.fail('Upgrade failed');
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`\n  Error: ${message}\n`));

    if (message.includes('401') || message.includes('Invalid')) {
      console.log(chalk.gray('  Your API key may have expired. Run `codebakers setup` to reconfigure.\n'));
    }

    process.exit(1);
  }
}
