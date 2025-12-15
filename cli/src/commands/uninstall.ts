import chalk from 'chalk';
import ora from 'ora';
import { existsSync, unlinkSync, rmSync } from 'fs';
import { join } from 'path';

export async function uninstall(): Promise<void> {
  console.log(chalk.blue('\n  CodeBakers Uninstall\n'));

  const spinner = ora('Removing patterns...').start();

  try {
    const cwd = process.cwd();
    let removed = 0;

    // Remove .cursorrules
    const cursorrules = join(cwd, '.cursorrules');
    if (existsSync(cursorrules)) {
      unlinkSync(cursorrules);
      removed++;
    }

    // Remove CLAUDE.md
    const claudemd = join(cwd, 'CLAUDE.md');
    if (existsSync(claudemd)) {
      unlinkSync(claudemd);
      removed++;
    }

    // Remove .claude directory
    const claudeDir = join(cwd, '.claude');
    if (existsSync(claudeDir)) {
      rmSync(claudeDir, { recursive: true });
      removed++;
    }

    if (removed > 0) {
      spinner.succeed('Patterns removed successfully!');
      console.log(chalk.gray(`\n  Removed ${removed} item(s)\n`));
    } else {
      spinner.info('No patterns found to remove');
      console.log(chalk.gray('\n  This directory has no CodeBakers patterns installed.\n'));
    }
  } catch (error) {
    spinner.fail('Uninstall failed');
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`\n  Error: ${message}\n`));
    process.exit(1);
  }
}
