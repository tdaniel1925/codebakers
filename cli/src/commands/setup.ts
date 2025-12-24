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
  const isWindows = process.platform === 'win32';

  console.log(chalk.green('\n  ✅ API key saved!\n'));
  console.log(chalk.blue('  ══════════════════════════════════════════════════════════'));
  console.log(chalk.white.bold('\n  STEP 2: Connect CodeBakers to Claude\n'));
  console.log(chalk.blue('  ══════════════════════════════════════════════════════════\n'));

  console.log(chalk.white('  Open a NEW terminal window and run this command:\n'));

  const terminalCmd = isWindows
    ? 'claude mcp add --transport stdio codebakers -- cmd /c npx -y @codebakers/cli serve'
    : 'claude mcp add --transport stdio codebakers -- npx -y @codebakers/cli serve';

  console.log(chalk.bgBlue.white('\n  ' + terminalCmd + '  \n'));

  console.log(chalk.gray('\n  ┌─────────────────────────────────────────────────────────┐'));
  console.log(chalk.gray('  │') + chalk.yellow(' ⚠️  IMPORTANT:                                          ') + chalk.gray('│'));
  console.log(chalk.gray('  │') + chalk.white('  • Run this in a TERMINAL, not in Claude Code chat     ') + chalk.gray('│'));
  console.log(chalk.gray('  │') + chalk.white('  • You only need to do this ONCE                       ') + chalk.gray('│'));
  console.log(chalk.gray('  │') + chalk.white('  • After running, restart Claude Code                  ') + chalk.gray('│'));
  console.log(chalk.gray('  └─────────────────────────────────────────────────────────┘\n'));

  console.log(chalk.blue('  ══════════════════════════════════════════════════════════'));
  console.log(chalk.white.bold('\n  STEP 3: Test it!\n'));
  console.log(chalk.blue('  ══════════════════════════════════════════════════════════\n'));

  console.log(chalk.white('  After restarting Claude Code, try this prompt:\n'));
  console.log(chalk.cyan('    "Build a login form with email validation"\n'));

  console.log(chalk.gray('  Claude will now use CodeBakers patterns automatically.\n'));

  console.log(chalk.gray('  Need help? https://codebakers.ai/docs\n'));
}
