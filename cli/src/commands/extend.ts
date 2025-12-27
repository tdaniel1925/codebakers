import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'child_process';
import {
  getTrialState,
  setTrialState,
  getApiUrl,
  getApiKey,
  isTrialExpired,
  type TrialState,
} from '../config.js';

/**
 * Open a URL in the default browser
 */
function openBrowser(url: string): void {
  const platform = process.platform;

  try {
    if (platform === 'win32') {
      execSync(`start "" "${url}"`, { stdio: 'ignore', shell: 'cmd.exe' });
    } else if (platform === 'darwin') {
      execSync(`open "${url}"`, { stdio: 'ignore' });
    } else {
      // Linux - try common browsers
      execSync(`xdg-open "${url}" || sensible-browser "${url}" || x-www-browser "${url}"`, {
        stdio: 'ignore',
        shell: '/bin/sh',
      });
    }
  } catch {
    console.log(chalk.yellow(`\n  Could not open browser automatically.`));
    console.log(chalk.gray(`  Please open this URL manually:\n`));
    console.log(chalk.cyan(`  ${url}\n`));
  }
}

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extend trial by connecting GitHub account
 */
export async function extend(): Promise<void> {
  console.log(chalk.blue(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   ${chalk.bold.white('Extend Your Trial with GitHub')}                       ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
  `));

  // Check if user already has an API key (paid user)
  const apiKey = getApiKey();
  if (apiKey) {
    console.log(chalk.green('  ✓ You\'re already logged in with an API key!\n'));
    console.log(chalk.gray('  You have unlimited access. No extension needed.\n'));
    return;
  }

  // Check for existing trial
  const trial = getTrialState();

  if (!trial) {
    console.log(chalk.yellow('  No trial found.\n'));
    console.log(chalk.white('  Start your free trial first:\n'));
    console.log(chalk.cyan('    codebakers go\n'));
    return;
  }

  // Check if already extended
  if (trial.stage === 'extended') {
    console.log(chalk.yellow('  Your trial has already been extended.\n'));

    if (isTrialExpired()) {
      console.log(chalk.white('  Ready to upgrade? $49/month for unlimited access:\n'));
      console.log(chalk.cyan('    codebakers upgrade\n'));
    } else {
      const expiresAt = new Date(trial.expiresAt);
      const daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
      console.log(chalk.gray(`  ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining.\n`));
    }
    return;
  }

  // Check if converted
  if (trial.stage === 'converted') {
    console.log(chalk.green('  ✓ You\'ve upgraded to a paid plan!\n'));
    console.log(chalk.gray('  Run ') + chalk.cyan('codebakers setup') + chalk.gray(' to configure your API key.\n'));
    return;
  }

  // Open browser for GitHub OAuth
  const apiUrl = getApiUrl();
  const authUrl = `${apiUrl}/api/auth/github?trial_id=${trial.trialId}`;

  console.log(chalk.white('  Opening browser for GitHub authorization...\n'));

  openBrowser(authUrl);

  console.log(chalk.gray('  Waiting for authorization...'));
  console.log(chalk.gray('  (This may take a moment)\n'));

  // Poll for completion
  const spinner = ora('Checking authorization status...').start();
  let extended = false;
  let pollCount = 0;
  const maxPolls = 60; // 2 minutes max

  while (pollCount < maxPolls && !extended) {
    await sleep(2000);
    pollCount++;

    try {
      const response = await fetch(`${apiUrl}/api/trial/status?trialId=${trial.trialId}`);
      const data = await response.json();

      if (data.stage === 'extended') {
        extended = true;

        // Update local trial state
        const updatedTrial: TrialState = {
          ...trial,
          stage: 'extended',
          expiresAt: data.expiresAt,
          extendedAt: new Date().toISOString(),
          ...(data.githubUsername && { githubUsername: data.githubUsername }),
        };

        setTrialState(updatedTrial);
        spinner.succeed('Trial extended!');
      }
    } catch {
      // Ignore polling errors
    }
  }

  if (extended) {
    console.log(chalk.green(`
  ╔═══════════════════════════════════════════════════════════╗
  ║  ✅ Trial Extended!                                       ║
  ║                                                           ║
  ║  ${chalk.white('You have 7 more days to build with CodeBakers.')}         ║
  ║                                                           ║
  ║  ${chalk.gray('Keep building - your project is waiting!')}                ║
  ╚═══════════════════════════════════════════════════════════╝
    `));
  } else {
    spinner.warn('Authorization timed out');
    console.log(chalk.yellow('\n  Please try again or authorize manually:\n'));
    console.log(chalk.cyan(`  ${authUrl}\n`));
  }
}
