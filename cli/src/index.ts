#!/usr/bin/env node

import { Command } from 'commander';
import { login } from './commands/login.js';
import { install } from './commands/install.js';
import { status } from './commands/status.js';
import { uninstall } from './commands/uninstall.js';
import { installHook, uninstallHook } from './commands/install-hook.js';
import { doctor } from './commands/doctor.js';
import { init } from './commands/init.js';

const program = new Command();

program
  .name('codebakers')
  .description('CodeBakers CLI - Production patterns for AI-assisted development')
  .version('1.0.0');

program
  .command('init')
  .description('Interactive setup wizard (recommended for new users)')
  .action(init);

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

program.parse();
