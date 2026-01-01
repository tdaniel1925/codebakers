import chalk from 'chalk';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { getApiKey } from '../config.js';
import { getCliVersion } from '../lib/api.js';

export async function status(): Promise<void> {
  console.log(chalk.blue('\n  CodeBakers Status (v6.0)\n'));

  // Show version
  const version = getCliVersion();
  console.log(chalk.gray(`  CLI Version: ${version}\n`));

  // Check login status
  const apiKey = getApiKey();
  if (apiKey) {
    console.log(chalk.green('  ✓ Logged in'));
    console.log(chalk.gray(`    Key: ${apiKey.slice(0, 10)}...`));
  } else {
    console.log(chalk.red('  ✗ Not logged in'));
    console.log(chalk.gray('    Run `codebakers setup` to authenticate'));
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

  // Check version of installed files
  let isV6 = false;
  if (hasClaudeMd) {
    const content = readFileSync(claudemd, 'utf-8');
    isV6 = content.includes('discover_patterns') || content.includes('v6.0');
  }

  if (hasCursorRules || hasClaudeMd) {
    if (isV6) {
      console.log(chalk.green('  ✓ CodeBakers v6.0 installed'));
      console.log(chalk.gray('    - CLAUDE.md (Claude Code gateway)'));
      console.log(chalk.gray('    - .cursorrules (Cursor IDE gateway)'));
      console.log(chalk.cyan('\n  v6.0 Features:'));
      console.log(chalk.gray('    - Server-side patterns (always up-to-date)'));
      console.log(chalk.gray('    - AI calls discover_patterns before coding'));
      console.log(chalk.gray('    - Usage tracking & compliance'));
    } else {
      console.log(chalk.yellow('  ⚠ CodeBakers v5 installed (legacy)'));
      if (hasCursorRules) {
        console.log(chalk.gray('    - .cursorrules'));
      }
      if (hasClaudeMd) {
        console.log(chalk.gray('    - CLAUDE.md'));
      }
      if (hasClaudeDir) {
        console.log(chalk.gray('    - .claude/ (local modules)'));
      }
      console.log(chalk.yellow('\n  Upgrade to v6.0:'));
      console.log(chalk.gray('    Run `codebakers go` to upgrade'));
    }
  } else {
    console.log(chalk.yellow('  ○ CodeBakers not installed in this directory'));
    console.log(chalk.gray('    Run `codebakers go` to install'));
  }

  // Warn about legacy folder
  if (hasClaudeDir && isV6) {
    console.log(chalk.yellow('\n  ⚠ Legacy .claude/ folder found'));
    console.log(chalk.gray('    This can be removed - v6.0 uses server-side patterns'));
  }

  console.log('');
}
