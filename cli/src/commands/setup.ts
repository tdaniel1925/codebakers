import chalk from 'chalk';
import ora from 'ora';
import { createInterface } from 'readline';
import { execSync } from 'child_process';
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
  console.log(chalk.white.bold('\n  STEP 2: Connecting CodeBakers to Claude...\n'));
  console.log(chalk.blue('  ══════════════════════════════════════════════════════════\n'));

  // Auto-install MCP server
  const mcpCmd = isWindows
    ? 'claude mcp add --transport stdio codebakers -- cmd /c npx -y @codebakers/cli serve'
    : 'claude mcp add --transport stdio codebakers -- npx -y @codebakers/cli serve';

  try {
    execSync(mcpCmd, { stdio: 'pipe' });
    console.log(chalk.green('  ✅ CodeBakers MCP server installed!\n'));
  } catch (error) {
    // Check if it's already installed (command might fail if already exists)
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('already exists') || errorMessage.includes('already registered')) {
      console.log(chalk.green('  ✅ CodeBakers MCP server already installed!\n'));
    } else {
      console.log(chalk.yellow('  ⚠️  Could not auto-install MCP server.\n'));
      console.log(chalk.white('  Run this command manually in your terminal:\n'));
      console.log(chalk.bgBlue.white('\n  ' + mcpCmd + '  \n'));
      console.log(chalk.yellow('\n  ⚠️  Then close this terminal and open a new one in your project.\n'));
      return;
    }
  }

  console.log(chalk.blue('  ══════════════════════════════════════════════════════════'));
  console.log(chalk.white.bold('\n  🎉 Setup Complete!\n'));
  console.log(chalk.blue('  ══════════════════════════════════════════════════════════\n'));

  console.log(chalk.yellow.bold('  ⚠️  RESTART REQUIRED - Follow these steps:\n'));

  console.log(chalk.white('  For Claude Code:\n'));
  console.log(chalk.gray('    1. Close this terminal completely (type ') + chalk.cyan('exit') + chalk.gray(')'));
  console.log(chalk.gray('    2. Open a NEW terminal window'));
  console.log(chalk.gray('    3. Navigate to your project folder'));
  console.log(chalk.gray('    4. Run ') + chalk.cyan('claude') + chalk.gray(' to start Claude Code\n'));

  console.log(chalk.white('  For Cursor:\n'));
  console.log(chalk.gray('    1. Close Cursor completely (Cmd+Q / Alt+F4)'));
  console.log(chalk.gray('    2. Reopen Cursor'));
  console.log(chalk.gray('    3. Open Composer (Cmd+I / Ctrl+I)\n'));

  console.log(chalk.blue('  ──────────────────────────────────────────────────────────\n'));

  console.log(chalk.white('  ✅ To verify CodeBakers is working, ask the AI:\n'));
  console.log(chalk.green('    "Are you using CodeBakers?"\n'));

  console.log(chalk.gray('  The AI should respond with its CodeBakers status.'));
  console.log(chalk.gray('  Need help? https://codebakers.ai/docs\n'));
}
