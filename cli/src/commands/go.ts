import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'child_process';
import {
  getTrialState,
  setTrialState,
  getApiUrl,
  getApiKey,
  isTrialExpired,
  getTrialDaysRemaining,
  type TrialState,
} from '../config.js';
import { getDeviceFingerprint } from '../lib/fingerprint.js';

/**
 * Zero-friction entry point - start using CodeBakers instantly
 */
export async function go(): Promise<void> {
  console.log(chalk.blue(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   ${chalk.bold.white('CodeBakers - Zero Setup Required')}                    ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
  `));

  // Check if user already has an API key (paid user)
  const apiKey = getApiKey();
  if (apiKey) {
    console.log(chalk.green('  ✓ You\'re already logged in with an API key!\n'));
    console.log(chalk.gray('  Run ') + chalk.cyan('codebakers status') + chalk.gray(' to check your setup.\n'));
    return;
  }

  // Check existing trial
  const existingTrial = getTrialState();

  if (existingTrial && !isTrialExpired()) {
    const daysRemaining = getTrialDaysRemaining();
    console.log(chalk.green(`  ✓ Trial active (${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining)\n`));

    if (existingTrial.stage === 'anonymous' && daysRemaining <= 2) {
      console.log(chalk.yellow('  ⚠️  Trial expiring soon! Extend with GitHub:\n'));
      console.log(chalk.cyan('    codebakers extend\n'));
    }

    await configureMCP();
    return;
  }

  // Check if trial expired
  if (existingTrial && isTrialExpired()) {
    console.log(chalk.yellow('  ⚠️  Your trial has expired.\n'));

    if (existingTrial.stage === 'anonymous') {
      console.log(chalk.white('  Extend your trial for 7 more days with GitHub:\n'));
      console.log(chalk.cyan('    codebakers extend\n'));
      console.log(chalk.gray('  Or upgrade to Pro ($49/month):\n'));
      console.log(chalk.cyan('    codebakers upgrade\n'));
    } else {
      console.log(chalk.white('  Ready to upgrade? $49/month for unlimited access:\n'));
      console.log(chalk.cyan('    codebakers upgrade\n'));
    }
    return;
  }

  // Start new trial
  const spinner = ora('Starting your free trial...').start();

  try {
    const fingerprint = getDeviceFingerprint();
    const apiUrl = getApiUrl();

    const response = await fetch(`${apiUrl}/api/trial/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceHash: fingerprint.deviceHash,
        machineId: fingerprint.machineId,
        platform: fingerprint.platform,
        hostname: fingerprint.hostname,
      }),
    });

    const data = await response.json();

    if (data.error === 'trial_not_available') {
      spinner.fail('Trial not available');
      console.log(chalk.yellow(`
  It looks like you've already used a CodeBakers trial.

  Ready to upgrade? $49/month for unlimited access.

  ${chalk.cyan('codebakers upgrade')} or visit ${chalk.underline('https://codebakers.ai/pricing')}
      `));
      return;
    }

    if (!response.ok) {
      throw new Error(data.error || 'Failed to start trial');
    }

    // Check if returning existing trial
    if (data.stage === 'expired') {
      spinner.warn('Your previous trial has expired');
      console.log('');

      if (data.canExtend) {
        console.log(chalk.white('  Extend your trial for 7 more days with GitHub:\n'));
        console.log(chalk.cyan('    codebakers extend\n'));
      } else {
        console.log(chalk.white('  Ready to upgrade? $49/month for unlimited access:\n'));
        console.log(chalk.cyan('    codebakers upgrade\n'));
      }
      return;
    }

    // Save trial state
    const trialState: TrialState = {
      trialId: data.trialId,
      stage: data.stage,
      deviceHash: fingerprint.deviceHash,
      expiresAt: data.expiresAt,
      startedAt: data.startedAt,
      ...(data.githubUsername && { githubUsername: data.githubUsername }),
      ...(data.projectId && { projectId: data.projectId }),
      ...(data.projectName && { projectName: data.projectName }),
    };

    setTrialState(trialState);

    spinner.succeed(`Trial started (${data.daysRemaining} days free)`);
    console.log('');

    // Configure MCP
    await configureMCP();

    // Show success message
    console.log(chalk.green(`
  ╔═══════════════════════════════════════════════════════════╗
  ║  ✅ CodeBakers is ready!                                  ║
  ║                                                           ║
  ║  ${chalk.white('Your 7-day free trial has started.')}                    ║
  ║                                                           ║
  ║  ${chalk.gray('Try: "Build me a todo app with authentication"')}        ║
  ╚═══════════════════════════════════════════════════════════╝
    `));

    // Attempt auto-restart Claude Code
    await attemptAutoRestart();

  } catch (error) {
    spinner.fail('Failed to start trial');

    if (error instanceof Error) {
      if (error.message.includes('fetch') || error.message.includes('network')) {
        console.log(chalk.red('\n  Could not connect to CodeBakers server.'));
        console.log(chalk.gray('  Check your internet connection and try again.\n'));
      } else {
        console.log(chalk.red(`\n  ${error.message}\n`));
      }
    } else {
      console.log(chalk.red('\n  An unexpected error occurred.\n'));
    }
  }
}

async function configureMCP(): Promise<void> {
  const spinner = ora('Configuring Claude Code integration...').start();
  const isWindows = process.platform === 'win32';

  const mcpCmd = isWindows
    ? 'claude mcp add --transport stdio codebakers -- cmd /c npx -y @codebakers/cli serve'
    : 'claude mcp add --transport stdio codebakers -- npx -y @codebakers/cli serve';

  try {
    execSync(mcpCmd, { stdio: 'pipe' });
    spinner.succeed('CodeBakers connected to Claude Code');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('already exists') || errorMessage.includes('already registered')) {
      spinner.succeed('CodeBakers already connected to Claude Code');
    } else {
      spinner.warn('Could not auto-configure Claude Code');
      console.log(chalk.gray('\n  Run this command manually:\n'));
      console.log(chalk.cyan(`  ${mcpCmd}\n`));
    }
  }
}

async function attemptAutoRestart(): Promise<void> {
  console.log(chalk.yellow('\n  ⚠️  RESTART REQUIRED\n'));
  console.log(chalk.gray('  Close this terminal and open a new one to activate CodeBakers.\n'));

  // Note: Auto-restart is risky and could lose user work
  // We show instructions instead of forcibly restarting
}
