import chalk from 'chalk';
import { execSync } from 'child_process';
import { getApiUrl, getApiKey, getTrialState, isTrialExpired, getTrialDaysRemaining } from '../config.js';

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
 * Open billing page for subscription management
 */
export async function billing(): Promise<void> {
  console.log(chalk.blue(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   ${chalk.bold.white('CodeBakers Billing & Subscription')}                   ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
  `));

  // Check current status
  const apiKey = getApiKey();
  const trial = getTrialState();

  if (apiKey) {
    console.log(chalk.green('  ✓ You have an active subscription\n'));
    console.log(chalk.gray('  Opening settings page to manage your subscription...\n'));

    const apiUrl = getApiUrl();
    const settingsUrl = `${apiUrl}/settings`;

    openBrowser(settingsUrl);
    console.log(chalk.gray(`  ${settingsUrl}\n`));
    return;
  }

  if (trial) {
    if (isTrialExpired()) {
      console.log(chalk.yellow('  ⚠️  Your trial has expired\n'));
    } else {
      const daysRemaining = getTrialDaysRemaining();
      console.log(chalk.gray(`  Trial: ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining\n`));
    }
  }

  // Show pricing
  console.log(chalk.white('  Choose your plan:\n'));

  console.log(chalk.cyan('  Pro     ') + chalk.white('- $49/month  ') + chalk.gray('(1 seat)'));
  console.log(chalk.gray('           All 40 pattern modules'));
  console.log(chalk.gray('           Unlimited projects'));
  console.log(chalk.gray('           Priority support\n'));

  console.log(chalk.cyan('  Team    ') + chalk.white('- $149/month ') + chalk.gray('(5 seats)'));
  console.log(chalk.gray('           Everything in Pro'));
  console.log(chalk.gray('           Team collaboration'));
  console.log(chalk.gray('           Shared API keys\n'));

  console.log(chalk.cyan('  Agency  ') + chalk.white('- $349/month ') + chalk.gray('(unlimited seats)'));
  console.log(chalk.gray('           Everything in Team'));
  console.log(chalk.gray('           White-label option'));
  console.log(chalk.gray('           Dedicated support\n'));

  console.log(chalk.gray('  Enterprise pricing available for large teams.\n'));

  // Open billing page
  const apiUrl = getApiUrl();
  const billingUrl = `${apiUrl}/billing`;

  console.log(chalk.white('  Opening billing page...\n'));

  openBrowser(billingUrl);

  console.log(chalk.gray(`  ${billingUrl}\n`));

  console.log(chalk.gray('  After subscribing, run:'));
  console.log(chalk.cyan('    codebakers setup\n'));
  console.log(chalk.gray('  to configure your API key.\n'));
}
