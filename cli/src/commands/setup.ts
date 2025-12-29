import chalk from 'chalk';
import ora from 'ora';
import { createInterface } from 'readline';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { setApiKey, getApiKey, getApiUrl, syncServiceKeys, SERVICE_KEY_LABELS, type ServiceName } from '../config.js';
import { validateApiKey, formatApiError, checkForUpdates, getCliVersion, type ApiError } from '../lib/api.js';
import { showQuickStartGuide, formatFriendlyError, getNetworkError, getAuthError } from '../lib/progress.js';

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

  // Check CLI version
  const version = getCliVersion();
  console.log(chalk.gray(`  CLI Version: ${version}\n`));

  // Check for updates
  const updateInfo = await checkForUpdates();
  if (updateInfo?.updateAvailable) {
    console.log(chalk.yellow(`  ⚠️  Update available: ${updateInfo.currentVersion} → ${updateInfo.latestVersion}`));
    console.log(chalk.gray('  Run: npm install -g @codebakers/cli@latest\n'));
  }

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

  // Validate API key using shared validation
  const spinner = ora('Validating API key...').start();

  try {
    await validateApiKey(apiKey);
    spinner.succeed('API key validated');
  } catch (error) {
    spinner.fail('Invalid API key');

    // Use friendly error formatting
    if (error && typeof error === 'object' && 'code' in error) {
      const code = (error as { code: string }).code;
      if (code === 'NETWORK_ERROR') {
        console.log(formatFriendlyError(getNetworkError()));
      } else if (code === 'UNAUTHORIZED' || code === 'INVALID_FORMAT') {
        console.log(formatFriendlyError(getAuthError()));
      } else if ('recoverySteps' in error) {
        console.log(chalk.red(`\n  ${formatApiError(error as ApiError)}\n`));
      }
    } else {
      const message = error instanceof Error ? error.message : 'API key validation failed';
      console.log(chalk.red(`\n  ${message}\n`));
    }

    process.exit(1);
  }

  // Save API key
  setApiKey(apiKey);
  console.log(chalk.green('  ✓ API key saved\n'));

  // Step 2: Sync service keys from server
  console.log(chalk.white('  Step 2: Syncing service keys...\n'));

  const syncSpinner = ora('Fetching service keys from your account...').start();

  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/cli/service-keys`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (response.ok) {
      const data = await response.json();
      const serverKeys = data.data || data;

      const result = syncServiceKeys(serverKeys);
      const totalSynced = result.added.length + result.updated.length;

      if (totalSynced > 0) {
        syncSpinner.succeed(`Synced ${totalSynced} service keys`);

        // Show which keys were synced
        for (const keyName of [...result.added, ...result.updated]) {
          console.log(chalk.green(`    ✓ ${SERVICE_KEY_LABELS[keyName as ServiceName]}`));
        }
        console.log('');
      } else if (result.unchanged.length > 0) {
        syncSpinner.succeed(`${result.unchanged.length} service keys already in sync`);
      } else {
        syncSpinner.succeed('No service keys configured in your account');
        console.log(chalk.gray('  Tip: Add keys at https://codebakers.ai/settings\n'));
      }
    } else {
      syncSpinner.warn('Could not sync service keys');
      console.log(chalk.gray('  You can add keys later in the scaffold wizard.\n'));
    }
  } catch {
    syncSpinner.warn('Could not sync service keys');
    console.log(chalk.gray('  You can add keys later in the scaffold wizard.\n'));
  }

  showFinalInstructions();
}

function showFinalInstructions(): void {
  const isWindows = process.platform === 'win32';
  const cwd = process.cwd();

  console.log(chalk.blue('  ══════════════════════════════════════════════════════════'));
  console.log(chalk.white.bold('\n  STEP 3: Connecting CodeBakers to your IDE...\n'));
  console.log(chalk.blue('  ══════════════════════════════════════════════════════════\n'));

  // Install MCP for Claude Code CLI
  const mcpCmd = isWindows
    ? 'claude mcp add --transport stdio codebakers -- cmd /c npx -y @codebakers/cli serve'
    : 'claude mcp add --transport stdio codebakers -- npx -y @codebakers/cli serve';

  let claudeCodeInstalled = false;
  try {
    execSync(mcpCmd, { stdio: 'pipe' });
    console.log(chalk.green('  ✅ Claude Code MCP server installed!\n'));
    claudeCodeInstalled = true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('already exists') || errorMessage.includes('already registered')) {
      console.log(chalk.green('  ✅ Claude Code MCP server already installed!\n'));
      claudeCodeInstalled = true;
    } else {
      console.log(chalk.yellow('  ⚠️  Claude Code not detected (that\'s OK if using Cursor)\n'));
    }
  }

  // Install MCP for Cursor IDE (create .cursor/mcp.json)
  const cursorDir = join(cwd, '.cursor');
  const mcpConfigPath = join(cursorDir, 'mcp.json');
  const mcpConfig = {
    mcpServers: {
      codebakers: isWindows
        ? { command: 'cmd', args: ['/c', 'npx', '-y', '@codebakers/cli', 'serve'] }
        : { command: 'npx', args: ['-y', '@codebakers/cli', 'serve'] }
    }
  };

  try {
    if (!existsSync(cursorDir)) {
      mkdirSync(cursorDir, { recursive: true });
    }

    // Merge with existing MCP config if present
    if (existsSync(mcpConfigPath)) {
      const existing = JSON.parse(readFileSync(mcpConfigPath, 'utf-8'));
      existing.mcpServers = { ...existing.mcpServers, ...mcpConfig.mcpServers };
      writeFileSync(mcpConfigPath, JSON.stringify(existing, null, 2));
    } else {
      writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
    }
    console.log(chalk.green('  ✅ Cursor MCP server configured! (.cursor/mcp.json)\n'));
  } catch (error) {
    console.log(chalk.yellow('  ⚠️  Could not create Cursor MCP config\n'));
  }

  console.log(chalk.blue('  ══════════════════════════════════════════════════════════'));
  console.log(chalk.white.bold('\n  🎉 Setup Complete!\n'));
  console.log(chalk.blue('  ══════════════════════════════════════════════════════════\n'));

  console.log(chalk.yellow.bold('  ⚠️  RESTART REQUIRED:\n'));

  console.log(chalk.white('  For Cursor:\n'));
  console.log(chalk.gray('    1. Close Cursor completely (Cmd+Q / Alt+F4)'));
  console.log(chalk.gray('    2. Reopen Cursor'));
  console.log(chalk.gray('    3. Open Composer (Cmd+I / Ctrl+I)\n'));

  if (claudeCodeInstalled) {
    console.log(chalk.white('  For Claude Code:\n'));
    console.log(chalk.gray('    1. Close this terminal completely (type ') + chalk.cyan('exit') + chalk.gray(')'));
    console.log(chalk.gray('    2. Open a NEW terminal window'));
    console.log(chalk.gray('    3. Navigate to your project folder'));
    console.log(chalk.gray('    4. Run ') + chalk.cyan('claude') + chalk.gray(' to start Claude Code\n'));
  }

  console.log(chalk.blue('  ──────────────────────────────────────────────────────────\n'));

  console.log(chalk.white('  Next step: Initialize patterns in your project:\n'));
  console.log(chalk.cyan('    codebakers init\n'));

  console.log(chalk.white('  To verify CodeBakers is working, ask the AI:\n'));
  console.log(chalk.green('    "update codebakers patterns"\n'));

  console.log(chalk.gray('  The AI should call the update_patterns MCP tool.'));
  console.log(chalk.gray('  Need help? https://codebakers.ai/docs\n'));
}
