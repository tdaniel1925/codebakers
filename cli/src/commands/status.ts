import chalk from 'chalk';
import { existsSync } from 'fs';
import { join } from 'path';
import { getApiKey } from '../config.js';

export async function status(): Promise<void> {
  console.log(chalk.blue('\n  CodeBakers Status\n'));

  // Check login status
  const apiKey = getApiKey();
  if (apiKey) {
    console.log(chalk.green('  ✓ Logged in'));
    console.log(chalk.gray(`    Key: ${apiKey.slice(0, 10)}...`));
  } else {
    console.log(chalk.red('  ✗ Not logged in'));
    console.log(chalk.gray('    Run `codebakers login` to authenticate'));
  }

  console.log('');

  // Check installation status in current directory
  const cwd = process.cwd();
  const cursorrules = join(cwd, '.cursorrules');
  const claudemd = join(cwd, 'CLAUDE.md');
  const claudeDir = join(cwd, '.claude');

  const hasCursorRules = existsSync(cursorrules);
  const hasClaudeMd = existsSync(claudemd);
  const hasClaudeDir = existsSync(claudeDir);

  if (hasCursorRules || hasClaudeMd || hasClaudeDir) {
    console.log(chalk.green('  ✓ Patterns installed in this directory'));
    if (hasCursorRules) {
      console.log(chalk.gray('    - .cursorrules (Cursor IDE)'));
    }
    if (hasClaudeMd) {
      console.log(chalk.gray('    - CLAUDE.md (Claude Code)'));
    }
    if (hasClaudeDir) {
      console.log(chalk.gray('    - .claude/ (Pattern modules)'));
    }
  } else {
    console.log(chalk.yellow('  ○ Patterns not installed in this directory'));
    console.log(chalk.gray('    Run `codebakers install` to install'));
  }

  console.log('');
}
