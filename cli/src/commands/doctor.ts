import chalk from 'chalk';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { isHookInstalled } from './install-hook.js';
import { getApiKey } from '../config.js';
import { checkApiKeyValidity, checkForUpdates, getCliVersion } from '../lib/api.js';

interface CheckResult {
  ok: boolean;
  message: string;
  details?: string;
}

/**
 * Run all health checks for CodeBakers setup
 */
export async function doctor(): Promise<void> {
  console.log(chalk.blue('\n  CodeBakers Doctor (v6.0)\n'));

  // Show version
  const version = getCliVersion();
  console.log(chalk.gray(`  CLI Version: ${version}\n`));

  console.log(chalk.gray('  Running health checks...\n'));

  const projectChecks = checkProject();
  const systemChecks = checkSystem();
  const authChecks = await checkAuth();

  // Display project checks
  console.log(chalk.white('  Project:'));
  for (const check of projectChecks) {
    const icon = check.ok ? chalk.green('✓') : chalk.red('✗');
    console.log(`    ${icon} ${check.message}`);
    if (check.details && !check.ok) {
      console.log(chalk.gray(`      └─ ${check.details}`));
    }
  }

  console.log(chalk.white('\n  System:'));
  for (const check of systemChecks) {
    const icon = check.ok ? chalk.green('✓') : chalk.red('✗');
    console.log(`    ${icon} ${check.message}`);
    if (check.details && !check.ok) {
      console.log(chalk.gray(`      └─ ${check.details}`));
    }
  }

  console.log(chalk.white('\n  Authentication:'));
  for (const check of authChecks) {
    const icon = check.ok ? chalk.green('✓') : chalk.red('✗');
    console.log(`    ${icon} ${check.message}`);
    if (check.details && !check.ok) {
      console.log(chalk.gray(`      └─ ${check.details}`));
    }
  }

  // Summary
  const allChecks = [...projectChecks, ...systemChecks, ...authChecks];
  const passed = allChecks.filter(c => c.ok).length;
  const total = allChecks.length;

  console.log('');
  if (passed === total) {
    console.log(chalk.green('  ✅ Everything looks good!\n'));
  } else {
    console.log(chalk.yellow(`  ⚠️  ${passed}/${total} checks passed. See issues above.\n`));

    // Provide fix suggestions
    console.log(chalk.white('  Suggested fixes:'));

    const claudeMdCheck = projectChecks.find(c => c.message.includes('CLAUDE.md'));
    if (claudeMdCheck && !claudeMdCheck.ok) {
      console.log(chalk.gray('    • Run: codebakers go'));
    }

    const hookCheck = systemChecks.find(c => c.message.includes('Hook'));
    if (hookCheck && !hookCheck.ok) {
      console.log(chalk.gray('    • Run: codebakers install-hook'));
    }

    const apiKeyCheck = authChecks.find(c => c.message.includes('API key'));
    if (apiKeyCheck && !apiKeyCheck.ok) {
      console.log(chalk.gray('    • Run: codebakers setup'));
    }

    console.log('');
  }

  // Check for updates
  const updateInfo = await checkForUpdates();
  if (updateInfo?.updateAvailable) {
    console.log(chalk.yellow(`  ⚠️  Update available: ${updateInfo.currentVersion} → ${updateInfo.latestVersion}`));
    console.log(chalk.gray('  Run: npm install -g @codebakers/cli@latest\n'));
  }
}

/**
 * Check project-level setup (v6.0 bootstrap files)
 */
function checkProject(): CheckResult[] {
  const results: CheckResult[] = [];
  const cwd = process.cwd();

  // Check CLAUDE.md with v6 content
  const claudeMdPath = join(cwd, 'CLAUDE.md');
  if (existsSync(claudeMdPath)) {
    const content = readFileSync(claudeMdPath, 'utf-8');
    if (content.includes('discover_patterns') || content.includes('v6.0')) {
      results.push({ ok: true, message: 'CLAUDE.md exists (v6.0 gateway)' });
    } else if (content.includes('CodeBakers') || content.includes('.claude')) {
      results.push({
        ok: false,
        message: 'CLAUDE.md exists but is v5 format',
        details: 'Run: codebakers go --upgrade'
      });
    } else {
      results.push({
        ok: false,
        message: 'CLAUDE.md exists but not CodeBakers',
        details: 'Run: codebakers go'
      });
    }
  } else {
    results.push({
      ok: false,
      message: 'CLAUDE.md not found',
      details: 'Run: codebakers go'
    });
  }

  // Check .cursorrules with v6 content
  const cursorRulesPath = join(cwd, '.cursorrules');
  if (existsSync(cursorRulesPath)) {
    const content = readFileSync(cursorRulesPath, 'utf-8');
    if (content.includes('discover_patterns') || content.includes('v6.0')) {
      results.push({ ok: true, message: '.cursorrules exists (v6.0 gateway)' });
    } else {
      results.push({
        ok: false,
        message: '.cursorrules exists but is old format',
        details: 'Run: codebakers go --upgrade'
      });
    }
  } else {
    results.push({
      ok: false,
      message: '.cursorrules not found',
      details: 'Run: codebakers go'
    });
  }

  // Check for legacy .claude folder (should be removed in v6)
  const claudeDir = join(cwd, '.claude');
  if (existsSync(claudeDir)) {
    results.push({
      ok: false,
      message: 'Legacy .claude/ folder found',
      details: 'v6.0 uses server-side patterns. Run: codebakers go --upgrade'
    });
  } else {
    results.push({ ok: true, message: 'No legacy .claude/ folder (v6.0 clean)' });
  }

  return results;
}

/**
 * Check system-level setup
 */
function checkSystem(): CheckResult[] {
  const results: CheckResult[] = [];

  // Check hook installation
  if (isHookInstalled()) {
    results.push({ ok: true, message: 'Hook installed in ~/.claude/settings.json' });
  } else {
    results.push({
      ok: false,
      message: 'Hook not installed',
      details: 'Run: codebakers install-hook'
    });
  }

  // Check ~/.claude directory exists
  const claudeConfigDir = join(homedir(), '.claude');
  if (existsSync(claudeConfigDir)) {
    results.push({ ok: true, message: '~/.claude directory exists' });
  } else {
    results.push({
      ok: false,
      message: '~/.claude directory not found',
      details: 'Run: codebakers install-hook (will create it)'
    });
  }

  // Check settings.json exists
  const settingsPath = join(claudeConfigDir, 'settings.json');
  if (existsSync(settingsPath)) {
    results.push({ ok: true, message: '~/.claude/settings.json exists' });
  } else {
    results.push({
      ok: true, // Will be created by install-hook
      message: '~/.claude/settings.json not found',
      details: 'Run: codebakers install-hook'
    });
  }

  return results;
}

/**
 * Check authentication status
 */
async function checkAuth(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Check if API key is configured
  const apiKey = getApiKey();
  if (!apiKey) {
    results.push({
      ok: false,
      message: 'API key not configured',
      details: 'Run: codebakers setup'
    });
    return results;
  }

  results.push({ ok: true, message: 'API key configured' });

  // Validate API key against server
  const validity = await checkApiKeyValidity();

  if (validity.valid) {
    results.push({ ok: true, message: 'API key is valid' });
  } else {
    results.push({
      ok: false,
      message: 'API key is invalid or expired',
      details: validity.error?.recoverySteps?.[0] || 'Run: codebakers setup'
    });
  }

  return results;
}

/**
 * Quick check - returns true if v6 setup is complete
 */
export function isSetupComplete(): boolean {
  const cwd = process.cwd();

  const hasClaudeMd = existsSync(join(cwd, 'CLAUDE.md'));
  const hasCursorRules = existsSync(join(cwd, '.cursorrules'));
  const hasHook = isHookInstalled();
  const hasApiKey = !!getApiKey();

  // v6: No .claude folder required
  return hasClaudeMd && hasCursorRules && hasHook && hasApiKey;
}
