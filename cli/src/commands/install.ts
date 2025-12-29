import chalk from 'chalk';
import ora from 'ora';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { getApiKey, getApiUrl } from '../config.js';
import { getCliVersion } from '../lib/api.js';
import { CODEBAKERS_STATS } from '../lib/stats.js';

interface ContentResponse {
  version: string;
  router: string;
  modules: Record<string, string>;
}

export async function install(): Promise<void> {
  console.log(chalk.blue('\n  CodeBakers Install\n'));

  const apiKey = getApiKey();
  if (!apiKey) {
    console.log(chalk.red('  Not logged in. Run `codebakers login` first.\n'));
    process.exit(1);
  }

  const spinner = ora('Downloading patterns...').start();

  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/content`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to fetch content');
    }

    const content: ContentResponse = await response.json();
    spinner.text = 'Installing patterns...';

    const cwd = process.cwd();

    // Write router file
    if (content.router) {
      writeFileSync(join(cwd, '.cursorrules'), content.router);
    }

    // Create CLAUDE.md symlink/copy for Claude Code
    if (content.router) {
      writeFileSync(join(cwd, 'CLAUDE.md'), content.router);
    }

    // Write modules
    const modulesDir = join(cwd, '.claude');
    if (content.modules && Object.keys(content.modules).length > 0) {
      if (!existsSync(modulesDir)) {
        mkdirSync(modulesDir, { recursive: true });
      }

      for (const [name, data] of Object.entries(content.modules)) {
        writeFileSync(join(modulesDir, name), data);
      }

      // Write version file for tracking
      const versionInfo = {
        version: content.version,
        moduleCount: Object.keys(content.modules).length,
        installedAt: new Date().toISOString(),
        cliVersion: getCliVersion(),
      };
      writeFileSync(join(modulesDir, '.version.json'), JSON.stringify(versionInfo, null, 2));
    }

    // Add to .gitignore if not present
    const gitignorePath = join(cwd, '.gitignore');
    if (existsSync(gitignorePath)) {
      const { readFileSync } = await import('fs');
      const gitignore = readFileSync(gitignorePath, 'utf-8');
      if (!gitignore.includes('.cursorrules')) {
        const additions = '\n# CodeBakers (encoded patterns)\n.cursorrules\n.claude/\n';
        writeFileSync(gitignorePath, gitignore + additions);
      }
    }

    const moduleCount = Object.keys(content.modules || {}).length;
    spinner.succeed('Patterns installed successfully!');

    console.log(chalk.green(`\n  Version: ${content.version}`));
    console.log(chalk.green(`  Modules: ${moduleCount}`));
    console.log(chalk.gray('\n  Files created:'));
    console.log(chalk.gray('    - .cursorrules (for Cursor IDE)'));
    console.log(chalk.gray('    - CLAUDE.md (for Claude Code)'));
    if (moduleCount > 0) {
      console.log(chalk.gray(`    - .claude/ (${moduleCount} pattern modules)`));
    }
    console.log(chalk.blue(`\n  Start building! Your AI now knows ${CODEBAKERS_STATS.moduleCount} production modules.\n`));
  } catch (error) {
    spinner.fail('Installation failed');
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`\n  Error: ${message}\n`));
    process.exit(1);
  }
}
