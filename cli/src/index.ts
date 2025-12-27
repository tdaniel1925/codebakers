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
  console.log(chalk.cyan('    codebakers setup') + chalk.gray('      One-time setup (recommended first step)'));
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
  console.log(chalk.gray('    setup, scaffold, init, generate, upgrade, status, audit, heal, doctor, config, login'));
  console.log(chalk.gray('    install, uninstall, install-hook, uninstall-hook'));
  console.log(chalk.gray('    serve, mcp-config, mcp-uninstall\n'));

  console.log(chalk.gray('  Run ') + chalk.cyan('codebakers <command> --help') + chalk.gray(' for more info\n'));
}

const program = new Command();

program
  .name('codebakers')
  .description('CodeBakers CLI - Production patterns for AI-assisted development')
  .version('2.8.0');

// Primary command - one-time setup
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

// Show welcome if no command provided
if (process.argv.length <= 2) {
  showWelcome();
} else {
  program.parse();
}
