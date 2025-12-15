#!/usr/bin/env node

import { Command } from 'commander';
import { login } from './commands/login.js';
import { install } from './commands/install.js';
import { status } from './commands/status.js';
import { uninstall } from './commands/uninstall.js';

const program = new Command();

program
  .name('codebakers')
  .description('CodeBakers CLI - Production patterns for AI-assisted development')
  .version('1.0.0');

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

program.parse();
