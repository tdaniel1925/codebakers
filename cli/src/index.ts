#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { login } from './commands/login.js';
import { install } from './commands/install.js';
import { status } from './commands/status.js';
import { uninstall } from './commands/uninstall.js';
import { installHook, uninstallHook } from './commands/install-hook.js';
import { doctor } from './commands/doctor.js';
import { init } from './commands/init.js';
import { serve } from './commands/serve.js';
import { mcpConfig, mcpUninstall } from './commands/mcp-config.js';
import { setup } from './commands/setup.js';
import { scaffold } from './commands/scaffold.js';
import { generate } from './commands/generate.js';
import { upgrade } from './commands/upgrade.js';
import { config } from './commands/config.js';
import { audit } from './commands/audit.js';
import { heal, healWatch } from './commands/heal.js';
import { pushPatterns, pushPatternsInteractive } from './commands/push-patterns.js';
import { go } from './commands/go.js';
import { extend } from './commands/extend.js';
import { billing } from './commands/billing.js';
import { getCachedUpdateInfo, setCachedUpdateInfo, getCliVersion, getCachedPatternInfo, setCachedPatternInfo, getApiKey, getApiUrl, getTrialState, hasValidAccess } from './config.js';
import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// ============================================
// Automatic Update Notification
// ============================================

const CURRENT_VERSION = '3.3.0';

async function checkForUpdatesInBackground(): Promise<void> {
  // Check if we have a valid cached result first (fast path)
  const cached = getCachedUpdateInfo();
  if (cached) {
    if (cached.latestVersion !== CURRENT_VERSION) {
      showUpdateBanner(CURRENT_VERSION, cached.latestVersion);
    }
    return;
  }

  // Fetch from npm registry (with timeout to not block CLI)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch('https://registry.npmjs.org/@codebakers/cli/latest', {
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      const latestVersion = data.version;
      setCachedUpdateInfo(latestVersion);

      if (latestVersion !== CURRENT_VERSION) {
        showUpdateBanner(CURRENT_VERSION, latestVersion);
      }
    }
  } catch {
    // Silently fail - don't block CLI for update check
  }
}

function showUpdateBanner(currentVersion: string, latestVersion: string): void {
  console.log(chalk.yellow(`
  ╭─────────────────────────────────────────────────────────╮
  │                                                         │
  │   ${chalk.bold('Update available!')} ${chalk.gray(currentVersion)} → ${chalk.green(latestVersion)}                     │
  │                                                         │
  │   Run ${chalk.cyan('npm i -g @codebakers/cli@latest')} to update        │
  │                                                         │
  ╰─────────────────────────────────────────────────────────╯
  `));
}

// ============================================
// Automatic Pattern Updates
// ============================================

interface PatternVersionInfo {
  version: string;
  moduleCount: number;
  updatedAt: string;
  cliVersion: string;
}

interface ContentResponse {
  version: string;
  router: string;
  modules: Record<string, string>;
}

function getLocalPatternVersion(): string | null {
  const cwd = process.cwd();
  const versionFile = join(cwd, '.claude', '.version.json');

  if (!existsSync(versionFile)) return null;

  try {
    const content = readFileSync(versionFile, 'utf-8');
    const info: PatternVersionInfo = JSON.parse(content);
    return info.version;
  } catch {
    return null;
  }
}

function isCodeBakersProject(): boolean {
  const cwd = process.cwd();
  return existsSync(join(cwd, 'CLAUDE.md')) || existsSync(join(cwd, '.claude'));
}

async function autoUpdatePatterns(): Promise<void> {
  // Only auto-update if this is a CodeBakers project
  if (!isCodeBakersProject()) return;

  // Only auto-update if user has valid access
  if (!hasValidAccess()) return;

  const localVersion = getLocalPatternVersion();

  // Check if we have a valid cached result first (fast path)
  const cached = getCachedPatternInfo();
  if (cached) {
    // If local matches latest, nothing to do
    if (localVersion === cached.latestVersion) return;
    // If we know there's an update but haven't updated yet, do it now
    if (localVersion !== cached.latestVersion) {
      await performPatternUpdate(cached.latestVersion);
    }
    return;
  }

  // Fetch from server to check for updates (with timeout)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const apiUrl = getApiUrl();
    const apiKey = getApiKey();
    const trial = getTrialState();

    // Build authorization header
    let authHeader = '';
    if (apiKey) {
      authHeader = `Bearer ${apiKey}`;
    } else if (trial?.trialId) {
      authHeader = `Trial ${trial.trialId}`;
    }

    if (!authHeader) return;

    // First, check the version endpoint (lightweight)
    const versionResponse = await fetch(`${apiUrl}/api/content/version`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (versionResponse.ok) {
      const versionData = await versionResponse.json();
      const serverVersion = versionData.version;

      // Cache the version info
      setCachedPatternInfo(serverVersion);

      // If local version is different, update
      if (localVersion !== serverVersion) {
        await performPatternUpdate(serverVersion);
      }
    }
  } catch {
    // Silently fail - don't block CLI for pattern check
  }
}

async function performPatternUpdate(targetVersion: string): Promise<void> {
  const cwd = process.cwd();
  const claudeMdPath = join(cwd, 'CLAUDE.md');
  const claudeDir = join(cwd, '.claude');

  try {
    const apiUrl = getApiUrl();
    const apiKey = getApiKey();
    const trial = getTrialState();

    let authHeader = '';
    if (apiKey) {
      authHeader = `Bearer ${apiKey}`;
    } else if (trial?.trialId) {
      authHeader = `Trial ${trial.trialId}`;
    }

    if (!authHeader) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${apiUrl}/api/content`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return;

    const content: ContentResponse = await response.json();

    // Update CLAUDE.md
    if (content.router) {
      writeFileSync(claudeMdPath, content.router);
    }

    // Update pattern modules
    if (content.modules && Object.keys(content.modules).length > 0) {
      if (!existsSync(claudeDir)) {
        mkdirSync(claudeDir, { recursive: true });
      }

      for (const [name, data] of Object.entries(content.modules)) {
        writeFileSync(join(claudeDir, name), data);
      }
    }

    // Write version file
    const moduleCount = Object.keys(content.modules || {}).length;
    const versionInfo: PatternVersionInfo = {
      version: content.version,
      moduleCount,
      updatedAt: new Date().toISOString(),
      cliVersion: getCliVersion(),
    };
    writeFileSync(join(claudeDir, '.version.json'), JSON.stringify(versionInfo, null, 2));

    // Show subtle notification
    console.log(chalk.green(`  ✓ Patterns auto-updated to v${content.version} (${moduleCount} modules)\n`));

  } catch {
    // Silently fail - don't block the user
  }
}

// Show welcome message when no command is provided
function showWelcome(): void {
  console.log(chalk.blue(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   ${chalk.bold.white('Welcome to CodeBakers!')}                               ║
  ║                                                           ║
  ║   AI-assisted development with production patterns        ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
  `));

  console.log(chalk.white('  Getting Started:\n'));
  console.log(chalk.cyan('    codebakers go') + chalk.gray('         Start free trial instantly (no signup!)'));
  console.log(chalk.cyan('    codebakers scaffold') + chalk.gray('   Create a new project from scratch'));
  console.log(chalk.cyan('    codebakers init') + chalk.gray('       Add patterns to existing project\n'));

  console.log(chalk.white('  Development:\n'));
  console.log(chalk.cyan('    codebakers generate') + chalk.gray('   Generate components, APIs, services'));
  console.log(chalk.cyan('    codebakers upgrade') + chalk.gray('    Update patterns to latest version'));
  console.log(chalk.cyan('    codebakers status') + chalk.gray('     Check what\'s installed'));
  console.log(chalk.cyan('    codebakers config') + chalk.gray('     View or modify configuration\n'));

  console.log(chalk.white('  Examples:\n'));
  console.log(chalk.gray('    $ ') + chalk.cyan('codebakers scaffold'));
  console.log(chalk.gray('      Create a new Next.js + Supabase + Drizzle project\n'));
  console.log(chalk.gray('    $ ') + chalk.cyan('codebakers generate component Button'));
  console.log(chalk.gray('      Generate a React component with TypeScript\n'));
  console.log(chalk.gray('    $ ') + chalk.cyan('codebakers g api users'));
  console.log(chalk.gray('      Generate a Next.js API route with validation\n'));

  console.log(chalk.white('  Quality:\n'));
  console.log(chalk.cyan('    codebakers audit') + chalk.gray('      Run automated code quality checks'));
  console.log(chalk.cyan('    codebakers heal') + chalk.gray('       Auto-detect and fix common issues'));
  console.log(chalk.cyan('    codebakers doctor') + chalk.gray('     Check CodeBakers setup\n'));

  console.log(chalk.white('  All Commands:\n'));
  console.log(chalk.gray('    go, extend, billing, setup, scaffold, init, generate, upgrade, status'));
  console.log(chalk.gray('    audit, heal, doctor, config, login, install, uninstall'));
  console.log(chalk.gray('    install-hook, uninstall-hook, serve, mcp-config, mcp-uninstall\n'));

  console.log(chalk.gray('  Run ') + chalk.cyan('codebakers <command> --help') + chalk.gray(' for more info\n'));
}

const program = new Command();

program
  .name('codebakers')
  .description('CodeBakers CLI - Production patterns for AI-assisted development')
  .version('3.3.0');

// Zero-friction trial entry (no signup required)
program
  .command('go')
  .alias('start')
  .description('Start using CodeBakers instantly (no signup required)')
  .option('-v, --verbose', 'Show detailed debug output for troubleshooting')
  .action((options) => go({ verbose: options.verbose }));

program
  .command('extend')
  .description('Extend your free trial with GitHub')
  .action(extend);

program
  .command('billing')
  .alias('subscribe')
  .description('Manage subscription or upgrade to paid plan')
  .action(billing);

// Primary command - one-time setup (for paid users)
program
  .command('setup')
  .description('One-time setup: login + configure Claude Code (recommended)')
  .action(setup);

program
  .command('init')
  .description('Interactive project setup wizard')
  .action(init);

program
  .command('scaffold')
  .alias('new')
  .description('Create a new project with full stack scaffolding (Next.js + Supabase + Drizzle)')
  .action(scaffold);

program
  .command('generate [type] [name]')
  .alias('g')
  .description('Generate code from templates (component, api, service, hook, page, schema, form)')
  .action((type, name) => generate({ type, name }));

program
  .command('upgrade')
  .description('Update patterns to the latest version')
  .action(upgrade);

program
  .command('config [action]')
  .description('View or modify CLI configuration (show, path, keys, clear-keys, set-url, reset)')
  .action((action) => config(action));

program
  .command('login')
  .description('Login with your API key')
  .action(login);

program
  .command('install')
  .description('Install patterns in the current project')
  .action(install);

program
  .command('status')
  .description('Check installation status')
  .action(status);

program
  .command('uninstall')
  .description('Remove patterns from the current project')
  .action(uninstall);

program
  .command('install-hook')
  .description('Install the CodeBakers hook into Claude Code')
  .action(installHook);

program
  .command('uninstall-hook')
  .description('Remove the CodeBakers hook from Claude Code')
  .action(uninstallHook);

program
  .command('doctor')
  .description('Check if CodeBakers is set up correctly')
  .action(doctor);

program
  .command('audit')
  .description('Run automated code quality and security checks')
  .action(async () => { await audit(); });

program
  .command('heal')
  .description('Auto-detect and fix common issues (TypeScript, deps, security)')
  .option('--auto', 'Automatically apply safe fixes')
  .option('--watch', 'Watch mode - continuously monitor and fix')
  .option('--dry-run', 'Show what would be fixed without applying')
  .option('--severity <level>', 'Filter by severity (critical, high, medium, low)')
  .action(async (options) => {
    if (options.watch) {
      await healWatch();
    } else {
      await heal({
        auto: options.auto,
        dryRun: options.dryRun,
        severity: options.severity
      });
    }
  });

// Admin commands
program
  .command('push-patterns')
  .description('Push pattern files to the server (admin only)')
  .option('-v, --version <version>', 'Version number (e.g., 4.5)')
  .option('-c, --changelog <message>', 'Changelog message')
  .option('-p, --publish', 'Auto-publish after push')
  .option('-s, --source <path>', 'Source directory (default: current directory)')
  .action(async (options) => {
    if (options.version) {
      await pushPatterns({
        version: options.version,
        changelog: options.changelog,
        autoPublish: options.publish,
        sourcePath: options.source,
      });
    } else {
      await pushPatternsInteractive();
    }
  });

// MCP Server commands
program
  .command('serve')
  .description('Start the MCP server for Claude Code integration')
  .action(serve);

program
  .command('mcp-config')
  .description('Show or install MCP configuration for Claude Code')
  .option('--install', 'Install to global Claude Code config')
  .option('--project', 'Create .mcp.json in current directory (for boilerplates)')
  .option('--show', 'Show configuration without installing')
  .action(mcpConfig);

program
  .command('mcp-uninstall')
  .description('Remove MCP configuration from Claude Code')
  .action(mcpUninstall);

// Add update check hook (runs before every command)
program.hook('preAction', async () => {
  // Run CLI update check and pattern auto-update in parallel
  await Promise.all([
    checkForUpdatesInBackground(),
    autoUpdatePatterns(),
  ]);
});

// Show welcome if no command provided
if (process.argv.length <= 2) {
  // Still check for updates when showing welcome
  checkForUpdatesInBackground().then(() => {
    showWelcome();
  });
} else {
  program.parse();
}
