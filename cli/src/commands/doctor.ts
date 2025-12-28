import chalk from 'chalk';
import { existsSync, readdirSync, readFileSync } from 'fs';
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
  console.log(chalk.blue('\n  CodeBakers Doctor\n'));

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
      console.log(chalk.gray('    • Run: codebakers install'));
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
 * Check project-level setup
 */
function checkProject(): CheckResult[] {
  const results: CheckResult[] = [];
  const cwd = process.cwd();

  // Check CLAUDE.md
  const claudeMdPath = join(cwd, 'CLAUDE.md');
  if (existsSync(claudeMdPath)) {
    const content = readFileSync(claudeMdPath, 'utf-8');
    if (content.includes('CODEBAKERS') || content.includes('CodeBakers') || content.includes('.claude')) {
      results.push({ ok: true, message: 'CLAUDE.md exists (CodeBakers router)' });
    } else {
      results.push({
        ok: false,
        message: 'CLAUDE.md exists but is not CodeBakers router',
        details: 'Run: codebakers install --force'
      });
    }
  } else {
    results.push({
      ok: false,
      message: 'CLAUDE.md not found',
      details: 'Run: codebakers install'
    });
  }

  // Check .claude folder
  const claudeDir = join(cwd, '.claude');
  if (existsSync(claudeDir)) {
    results.push({ ok: true, message: '.claude/ folder exists' });

    // Count modules
    try {
      const files = readdirSync(claudeDir).filter(f => f.endsWith('.md'));
      const moduleCount = files.length;

      if (moduleCount >= 40) {
        results.push({ ok: true, message: `${moduleCount} modules present (full set)` });
      } else if (moduleCount >= 10) {
        results.push({
          ok: true,
          message: `${moduleCount} modules present (partial set)`,
          details: 'Run: codebakers upgrade to get all 47 modules'
        });
      } else if (moduleCount > 0) {
        results.push({
          ok: false,
          message: `Only ${moduleCount} modules found (expected 47)`,
          details: 'Run: codebakers upgrade to get all modules'
        });
      } else {
        results.push({
          ok: false,
          message: 'No modules found in .claude/',
          details: 'Run: codebakers install'
        });
      }

      // Check for 00-core.md
      const corePath = join(claudeDir, '00-core.md');
      if (existsSync(corePath)) {
        results.push({ ok: true, message: '00-core.md exists (base patterns)' });
      } else {
        results.push({
          ok: false,
          message: '00-core.md not found',
          details: 'This module is loaded on every task'
        });
      }

      // Check for 00-system.md
      const systemPath = join(claudeDir, '00-system.md');
      if (existsSync(systemPath)) {
        results.push({ ok: true, message: '00-system.md exists (workflow module)' });
      } else {
        results.push({
          ok: true, // Not required, just recommended
          message: '00-system.md not found (optional workflow module)',
          details: 'Contains 9-step execution flow'
        });
      }
    } catch {
      results.push({
        ok: false,
        message: 'Could not read .claude/ folder',
        details: 'Check folder permissions'
      });
    }
  } else {
    results.push({
      ok: false,
      message: '.claude/ folder not found',
      details: 'Run: codebakers install'
    });
  }

  // Check PROJECT-STATE.md (optional)
  const statePath = join(cwd, 'PROJECT-STATE.md');
  if (existsSync(statePath)) {
    results.push({ ok: true, message: 'PROJECT-STATE.md exists' });
  } else {
    results.push({
      ok: true, // It's optional
      message: 'PROJECT-STATE.md not found (created on first run)',
    });
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
 * Quick check - returns true if basic setup is complete
 */
export function isSetupComplete(): boolean {
  const cwd = process.cwd();

  const hasClaudeMd = existsSync(join(cwd, 'CLAUDE.md'));
  const hasClaudeDir = existsSync(join(cwd, '.claude'));
  const hasHook = isHookInstalled();
  const hasApiKey = !!getApiKey();

  return hasClaudeMd && hasClaudeDir && hasHook && hasApiKey;
}
