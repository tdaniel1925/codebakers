import chalk from 'chalk';
import ora from 'ora';
import { createInterface } from 'readline';
import { setApiKey, getApiKey, getApiUrl } from '../config.js';

function prompt(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function setup(): Promise<void> {
  console.log(chalk.blue('\n  ╔══════════════════════════════════════╗'));
  console.log(chalk.blue('  ║') + chalk.white('     CodeBakers One-Time Setup        ') + chalk.blue('║'));
  console.log(chalk.blue('  ╚══════════════════════════════════════╝\n'));

  // Check if already set up
  const existingKey = getApiKey();
  if (existingKey) {
    console.log(chalk.yellow('  You\'re already logged in!\n'));
    const reconfigure = await prompt(chalk.gray('  Reconfigure? (y/N): '));
    if (reconfigure.toLowerCase() !== 'y') {
      showFinalInstructions();
      return;
    }
    console.log('');
  }

  // Step 1: Get API key
  console.log(chalk.white('  Step 1: Enter your API key\n'));
  console.log(chalk.gray('  Find it at: https://codebakers.ai/dashboard\n'));

  const apiKey = await prompt(chalk.cyan('  API Key: '));

  if (!apiKey) {
    console.log(chalk.red('\n  API key is required.\n'));
    process.exit(1);
  }

  // Validate API key
  const spinner = ora('Validating API key...').start();

  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/patterns`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      spinner.fail('Invalid API key');
      const error = await response.json().catch(() => ({}));
      console.log(chalk.red(`\n  ${error.error || 'API key validation failed'}\n`));
      process.exit(1);
    }

    spinner.succeed('API key validated');
  } catch {
    spinner.fail('Could not connect to CodeBakers');
    console.log(chalk.red('\n  Check your internet connection and try again.\n'));
    process.exit(1);
  }

  // Save API key
  setApiKey(apiKey);
  console.log(chalk.green('  ✓ API key saved\n'));

  showFinalInstructions();
}

function showFinalInstructions(): void {
  console.log(chalk.white('  Step 2: Enable in Claude Code\n'));
  console.log(chalk.gray('  Copy this command and paste it into Claude Code:\n'));

  // Box around the command for easy copying
  const command = '/mcp add codebakers npx -y @codebakers/cli serve';
  console.log(chalk.cyan('  ┌─────────────────────────────────────────────────────┐'));
  console.log(chalk.cyan('  │ ') + chalk.white(command) + chalk.cyan(' │'));
  console.log(chalk.cyan('  └─────────────────────────────────────────────────────┘\n'));

  console.log(chalk.gray('  This only needs to be done once. No restart needed!\n'));

  console.log(chalk.blue('  ══════════════════════════════════════\n'));
  console.log(chalk.green('  Almost done! 🎉\n'));
  console.log(chalk.white('  After running that command in Claude Code:\n'));
  console.log(chalk.gray('  • Claude will have access to 34 production patterns'));
  console.log(chalk.gray('  • Patterns are fetched on-demand (never stored locally)'));
  console.log(chalk.gray('  • Works across all your projects\n'));

  console.log(chalk.white('  Example prompt to try:\n'));
  console.log(chalk.cyan('    "Build a login form with email validation"\n'));

  console.log(chalk.gray('  Need help? https://codebakers.ai/docs\n'));
}
