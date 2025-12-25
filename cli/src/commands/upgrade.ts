import chalk from 'chalk';
import ora from 'ora';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getApiKey, getApiUrl } from '../config.js';
import { checkForUpdates, getCliVersion } from '../lib/api.js';

interface ContentResponse {
  version: string;
  router: string;
  modules: Record<string, string>;
}

/**
 * Upgrade CodeBakers patterns to the latest version
 */
export async function upgrade(): Promise<void> {
  console.log(chalk.blue('\n  CodeBakers Upgrade\n'));

  const cwd = process.cwd();
  const claudeMdPath = join(cwd, 'CLAUDE.md');
  const claudeDir = join(cwd, '.claude');

  // Check if this is a CodeBakers project
  if (!existsSync(claudeMdPath) && !existsSync(claudeDir)) {
    console.log(chalk.yellow('  No CodeBakers installation found in this directory.\n'));
    console.log(chalk.gray('  Run `codebakers install` to set up patterns first.\n'));
    return;
  }

  // Check for CLI updates
  console.log(chalk.gray('  Checking for CLI updates...\n'));
  const updateInfo = await checkForUpdates();

  if (updateInfo?.updateAvailable) {
    console.log(chalk.yellow(`  ⚠️  CLI update available: ${updateInfo.currentVersion} → ${updateInfo.latestVersion}`));
    console.log(chalk.gray('  Run: npm install -g @codebakers/cli@latest\n'));
  } else {
    console.log(chalk.green(`  ✓ CLI is up to date (v${getCliVersion()})\n`));
  }

  // Check API key
  const apiKey = getApiKey();
  if (!apiKey) {
    console.log(chalk.yellow('  Not logged in. Run `codebakers setup` first.\n'));
    return;
  }

  // Fetch latest patterns
  const spinner = ora('Fetching latest patterns...').start();

  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/content`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to fetch patterns');
    }

    const content: ContentResponse = await response.json();

    spinner.succeed(`Patterns v${content.version} downloaded`);

    // Count what we're updating
    const moduleCount = Object.keys(content.modules).length;

    console.log(chalk.gray(`  Updating ${moduleCount} modules...\n`));

    // Update CLAUDE.md
    if (content.router) {
      writeFileSync(claudeMdPath, content.router);
      console.log(chalk.green('  ✓ Updated CLAUDE.md'));
    }

    // Update pattern modules
    if (content.modules && Object.keys(content.modules).length > 0) {
      if (!existsSync(claudeDir)) {
        mkdirSync(claudeDir, { recursive: true });
      }

      for (const [name, data] of Object.entries(content.modules)) {
        writeFileSync(join(claudeDir, name), data);
      }

      console.log(chalk.green(`  ✓ Updated ${moduleCount} modules in .claude/`));
    }

    console.log(chalk.green(`\n  ✅ Upgraded to patterns v${content.version}!\n`));

    // Show what's new if available
    console.log(chalk.gray('  Changes take effect in your next AI session.\n'));

  } catch (error) {
    spinner.fail('Upgrade failed');
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`\n  Error: ${message}\n`));

    if (message.includes('401') || message.includes('Invalid')) {
      console.log(chalk.gray('  Your API key may have expired. Run `codebakers setup` to reconfigure.\n'));
    }

    process.exit(1);
  }
}
