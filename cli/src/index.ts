#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { login } from './commands/login.js';
import { install } from './commands/install.js';
import { status } from './commands/status.js';
import { uninstall } from './commands/uninstall.js';
import { installHook, uninstallHook } from './commands/install-hook.js';
import { installPrecommit } from './commands/install-precommit.js';
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
import { build, buildStatus } from './commands/build.js';
import { getCachedUpdateInfo, setCachedUpdateInfo, getCliVersion, getCachedPatternInfo, setCachedPatternInfo, getApiKey, getApiUrl, getTrialState, hasValidAccess, shouldAttemptCliUpdate, setCliUpdateAttempt, isCliAutoUpdateDisabled } from './config.js';
import { execSync } from 'child_process';
import { checkForUpdates } from './lib/api.js';
import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// ============================================
// Automatic Update Notification
// ============================================

const CURRENT_VERSION = '3.9.5';

async function checkForUpdatesInBackground(): Promise<void> {
  // Check if we have a valid cached result first (fast path)
  const cached = getCachedUpdateInfo();
  if (cached) {
    if (cached.latestVersion !== CURRENT_VERSION) {
      showUpdateBanner(CURRENT_VERSION, cached.latestVersion, false);
    }
    return;
  }

  // Use the API-based version check (with controlled rollout support)
  try {
    const updateInfo = await checkForUpdates();

    if (updateInfo) {
      setCachedUpdateInfo(updateInfo.latestVersion);

      // Show blocked version warning first (critical)
      if (updateInfo.isBlocked) {
        showBlockedVersionWarning(updateInfo.currentVersion, updateInfo.latestVersion);
        return;
      }

      // Only show update banner if auto-update is enabled for this version
      if (updateInfo.autoUpdateEnabled && updateInfo.autoUpdateVersion) {
        showUpdateBanner(updateInfo.currentVersion, updateInfo.autoUpdateVersion, true);
      } else if (updateInfo.updateAvailable) {
        // Update available but not auto-update enabled - show regular banner
        showUpdateBanner(updateInfo.currentVersion, updateInfo.latestVersion, false);
      }
    }
  } catch {
    // Silently fail - don't block CLI for update check
  }
}

function showBlockedVersionWarning(currentVersion: string, recommendedVersion: string): void {
  console.log(chalk.red(`
  ╭─────────────────────────────────────────────────────────╮
  │                                                         │
  │   ${chalk.bold('⚠️  VERSION BLOCKED')}                                   │
  │                                                         │
  │   Your CLI version ${chalk.gray(currentVersion)} has critical issues.       │
  │   Please update immediately to ${chalk.green(recommendedVersion)}                   │
  │                                                         │
  │   Run ${chalk.cyan('npm i -g @codebakers/cli@latest')} to update        │
  │                                                         │
  ╰─────────────────────────────────────────────────────────╯
  `));
}

function showUpdateBanner(currentVersion: string, latestVersion: string, isRecommended: boolean): void {
  const updateType = isRecommended ? chalk.green('Recommended update') : chalk.bold('Update available!');
  console.log(chalk.yellow(`
  ╭─────────────────────────────────────────────────────────╮
  │                                                         │
  │   ${updateType} ${chalk.gray(currentVersion)} → ${chalk.green(latestVersion)}                     │
  │                                                         │
  │   Run ${chalk.cyan('npm i -g @codebakers/cli@latest')} to update        │
  │                                                         │
  ╰─────────────────────────────────────────────────────────╯
  `));
}

// ============================================
// CLI Auto-Update
// ============================================

async function autoUpdateCli(): Promise<void> {
  // Check if auto-update is disabled
  if (isCliAutoUpdateDisabled()) return;

  // Check if we should attempt update (cooldown, etc.)
  if (!shouldAttemptCliUpdate()) return;

  // Check for available updates
  try {
    const updateInfo = await checkForUpdates();

    if (!updateInfo || !updateInfo.updateAvailable) return;

    // Don't auto-update blocked versions - show warning instead
    if (updateInfo.isBlocked) return;

    const targetVersion = updateInfo.latestVersion;
    const currentVersion = CURRENT_VERSION;

    // Only auto-update if the version has auto-update enabled from server
    if (!updateInfo.autoUpdateEnabled) return;

    console.log(chalk.blue(`\n  🔄 Auto-updating CLI: ${chalk.gray(currentVersion)} → ${chalk.green(targetVersion)}...\n`));

    try {
      // Run npm install globally
      execSync('npm install -g @codebakers/cli@latest', {
        stdio: 'inherit',
        timeout: 60000, // 60 second timeout
      });

      setCliUpdateAttempt(targetVersion, true);

      console.log(chalk.green(`\n  ✓ CLI updated to v${targetVersion}!\n`));
      console.log(chalk.gray('  The update will take effect on your next command.\n'));

    } catch (installError) {
      setCliUpdateAttempt(targetVersion, false);

      // Check if it's a permission error
      const errorMessage = installError instanceof Error ? installError.message : String(installError);
      if (errorMessage.includes('EACCES') || errorMessage.includes('permission')) {
        console.log(chalk.yellow(`
  ⚠️  Auto-update failed (permission denied)

  Run manually with: ${chalk.cyan('sudo npm i -g @codebakers/cli@latest')}
  Or disable auto-update: ${chalk.cyan('codebakers config set disableCliAutoUpdate true')}
        `));
      } else {
        console.log(chalk.yellow(`
  ⚠️  Auto-update failed

  Run manually: ${chalk.cyan('npm i -g @codebakers/cli@latest')}
        `));
      }
    }
  } catch {
    // Silently fail - don't block CLI for update check
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
  console.log(chalk.cyan('    codebakers build') + chalk.gray('      Describe your project → Get working code'));
  console.log(chalk.cyan('    codebakers scaffold') + chalk.gray('   Create a new project from scratch'));
  console.log(chalk.cyan('    codebakers init') + chalk.gray('       Set up CodeBakers in existing project\n'));

  console.log(chalk.white('  Development:\n'));
  console.log(chalk.cyan('    codebakers generate') + chalk.gray('   Generate components, APIs, services'));
  console.log(chalk.cyan('    codebakers upgrade') + chalk.gray('    Check for CLI updates'));
  console.log(chalk.cyan('    codebakers status') + chalk.gray('     Check project status'));
  console.log(chalk.cyan('    codebakers config') + chalk.gray('     View or modify configuration\n'));

  console.log(chalk.white('  Examples:\n'));
  console.log(chalk.gray('    $ ') + chalk.cyan('codebakers build "SaaS for invoicing"'));
  console.log(chalk.gray('      AI generates full project with auth, payments, dashboard\n'));
  console.log(chalk.gray('    $ ') + chalk.cyan('codebakers scaffold'));
  console.log(chalk.gray('      Create a new Next.js + Supabase + Drizzle project\n'));
  console.log(chalk.gray('    $ ') + chalk.cyan('codebakers generate component Button'));
  console.log(chalk.gray('      Generate a React component with TypeScript\n'));

  console.log(chalk.white('  Quality:\n'));
  console.log(chalk.cyan('    codebakers audit') + chalk.gray('      Run automated code quality checks'));
  console.log(chalk.cyan('    codebakers heal') + chalk.gray('       Auto-detect and fix common issues'));
  console.log(chalk.cyan('    codebakers doctor') + chalk.gray('     Check CodeBakers setup\n'));

  console.log(chalk.white('  All Commands:\n'));
  console.log(chalk.gray('    go, extend, billing, build, build-status, setup, scaffold, init'));
  console.log(chalk.gray('    generate, upgrade, status, audit, heal, doctor, config, login'));
  console.log(chalk.gray('    serve, mcp-config, mcp-uninstall\n'));

  console.log(chalk.gray('  Run ') + chalk.cyan('codebakers <command> --help') + chalk.gray(' for more info\n'));
}

const program = new Command();

program
  .name('codebakers')
  .description('CodeBakers CLI - Production patterns for AI-assisted development')
  .version('3.9.5');

// Zero-friction trial entry (no signup required)
program
  .command('go')
  .alias('start')
  .description('Start using CodeBakers instantly (no signup required)')
  .option('-v, --verbose', 'Show detailed debug output for troubleshooting')
  // Non-interactive flags for programmatic use (e.g., by AI assistants)
  .option('-t, --type <type>', 'Project type: personal, client, or business')
  .option('-n, --name <name>', 'Project name')
  .option('-d, --describe <mode>', 'Description mode: guided, template, paste, chat, or files')
  .option('--skip-review', 'Skip the review question for existing projects')
  .action((options) => go({
    verbose: options.verbose,
    type: options.type,
    name: options.name,
    describe: options.describe,
    skipReview: options.skipReview,
  }));

program
  .command('extend')
  .description('Extend your free trial with GitHub')
  .action(extend);

program
  .command('billing')
  .alias('subscribe')
  .description('Manage subscription or upgrade to paid plan')
  .action(billing);

// AI Build command - describe what you want, get working code
program
  .command('build [description]')
  .description('Build a project from description - AI generates actual files')
  .option('-o, --output <dir>', 'Output directory (default: current directory)')
  .option('-v, --verbose', 'Show detailed progress')
  .action((description, options) => build({
    description,
    output: options.output,
    verbose: options.verbose,
  }));

program
  .command('build-status')
  .description('Check status of recent builds')
  .action(buildStatus);

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
  .command('install-precommit')
  .description('Install git pre-commit hook for session enforcement (v6.0)')
  .action(installPrecommit);

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
  // Run CLI auto-update first (if enabled and conditions met)
  await autoUpdateCli();

  // Check for CLI updates in background
  await checkForUpdatesInBackground();
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
