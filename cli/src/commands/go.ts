import chalk from 'chalk';
import ora from 'ora';
import { execSync, spawn } from 'child_process';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import {
  getTrialState,
  setTrialState,
  getApiUrl,
  getApiKey,
  setApiKey,
  isTrialExpired,
  getTrialDaysRemaining,
  type TrialState,
} from '../config.js';
import { validateApiKey } from '../lib/api.js';
import { getDeviceFingerprint } from '../lib/fingerprint.js';

function prompt(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

interface GoOptions {
  verbose?: boolean;
}

interface ConfirmData {
  version: string;
  moduleCount: number;
  cliVersion?: string;
  command: string;
  projectName?: string;
}

interface AuthInfo {
  apiKey?: string;
  trialId?: string;
}

/**
 * Get CLI version from package.json
 */
function getCliVersion(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('../../package.json');
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * Confirm download to server (non-blocking, fire-and-forget)
 */
async function confirmDownload(apiUrl: string, auth: AuthInfo, data: ConfirmData): Promise<void> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (auth.apiKey) {
      headers['Authorization'] = `Bearer ${auth.apiKey}`;
    }
    if (auth.trialId) {
      headers['X-Trial-ID'] = auth.trialId;
    }

    await fetch(`${apiUrl}/api/content/confirm`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
  } catch {
    // Silently ignore - this is just for analytics
  }
}

function log(message: string, options?: GoOptions): void {
  if (options?.verbose) {
    console.log(chalk.gray(`  [verbose] ${message}`));
  }
}

/**
 * Zero-friction entry point - start using CodeBakers instantly
 * Single command for both trial and paid users
 */
export async function go(options: GoOptions = {}): Promise<void> {
  log('Starting go command...', options);
  log(`API URL: ${getApiUrl()}`, options);
  log(`Working directory: ${process.cwd()}`, options);

  console.log(chalk.blue(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   ${chalk.bold.white('CodeBakers - Get Started')}                             ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
  `));

  // Check if user already has an API key (paid user)
  log('Checking for existing API key...', options);
  const existingApiKey = getApiKey();
  if (existingApiKey) {
    log(`Found API key: ${existingApiKey.substring(0, 8)}...`, options);
    console.log(chalk.green('  ✓ You\'re already logged in!\n'));

    // Install patterns if not already installed
    await installPatternsWithApiKey(existingApiKey, options);
    await configureMCP(options);
    await showSuccessAndRestart();
    return;
  }
  log('No API key found, checking trial state...', options);

  // Check existing trial
  const existingTrial = getTrialState();

  if (existingTrial && !isTrialExpired()) {
    const daysRemaining = getTrialDaysRemaining();
    console.log(chalk.green(`  ✓ Trial active (${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining)\n`));

    if (existingTrial.stage === 'anonymous' && daysRemaining <= 2) {
      console.log(chalk.yellow('  ⚠️  Trial expiring soon! Extend with GitHub:\n'));
      console.log(chalk.cyan('    codebakers extend\n'));
    }

    // Install patterns if not already installed
    await installPatterns(existingTrial.trialId, options);
    await configureMCP(options);
    await showSuccessAndRestart();
    return;
  }

  // Check if trial expired
  if (existingTrial && isTrialExpired()) {
    console.log(chalk.yellow('  ⚠️  Your trial has expired.\n'));

    // Offer to login with API key or extend
    console.log(chalk.white('  Options:\n'));
    console.log(chalk.cyan('  [1] Login with API key') + chalk.gray(' (I have an account)'));
    console.log(chalk.cyan('  [2] Extend trial') + chalk.gray(' (7 more days with GitHub)\n'));

    const choice = await prompt(chalk.gray('  Enter 1 or 2: '));

    if (choice === '1') {
      await handleApiKeyLogin(options);
      return;
    } else {
      console.log(chalk.cyan('\n  Run: codebakers extend\n'));
      return;
    }
  }

  // New user - ask how they want to proceed
  console.log(chalk.white('  How would you like to get started?\n'));
  console.log(chalk.cyan('  [1] Start free 7-day trial') + chalk.gray(' (no signup required)'));
  console.log(chalk.cyan('  [2] Login with API key') + chalk.gray(' (I have an account)\n'));

  const choice = await prompt(chalk.gray('  Enter 1 or 2: '));

  if (choice === '2') {
    await handleApiKeyLogin(options);
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

    // Install v6.0 bootstrap files (CLAUDE.md and .cursorrules only)
    await installPatterns(data.trialId, options);

    // Configure MCP
    await configureMCP(options);

    // Show success and restart
    await showSuccessAndRestart();

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

async function configureMCP(options: GoOptions = {}): Promise<void> {
  log('Configuring MCP integration...', options);
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

/**
 * Handle API key login flow (for paid users)
 */
async function handleApiKeyLogin(options: GoOptions = {}): Promise<void> {
  console.log(chalk.white('\n  Enter your API key\n'));
  console.log(chalk.gray('  Find it at: https://codebakers.ai/dashboard\n'));

  const apiKey = await prompt(chalk.cyan('  API Key: '));

  if (!apiKey) {
    console.log(chalk.red('\n  API key is required.\n'));
    return;
  }

  const spinner = ora('Validating API key...').start();

  try {
    await validateApiKey(apiKey);
    spinner.succeed('API key validated');

    // Save API key
    setApiKey(apiKey);
    console.log(chalk.green('  ✓ Logged in successfully!\n'));

    // Install patterns
    await installPatternsWithApiKey(apiKey, options);

    // Configure MCP
    await configureMCP(options);

    // Show success
    await showSuccessAndRestart();

  } catch (error) {
    spinner.fail('Invalid API key');
    console.log(chalk.red('\n  Could not validate API key.'));
    console.log(chalk.gray('  Check your key at: https://codebakers.ai/dashboard\n'));
  }
}

/**
 * Show success message and offer to restart
 */
async function showSuccessAndRestart(): Promise<void> {
  const cwd = process.cwd();

  console.log(chalk.green(`
  ╔═══════════════════════════════════════════════════════════╗
  ║  ✅ CodeBakers is ready!                                  ║
  ║                                                           ║
  ║  ${chalk.gray('Try: "Build me a todo app with authentication"')}        ║
  ╚═══════════════════════════════════════════════════════════╝
  `));

  console.log(chalk.yellow('  ⚠️  RESTART REQUIRED\n'));
  console.log(chalk.gray('  Claude Code needs to restart to load CodeBakers.\n'));

  const answer = await prompt(chalk.cyan('  Restart Claude Code now? (Y/n): '));

  if (answer === 'n' || answer === 'no') {
    console.log(chalk.gray('\n  No problem! Just restart Claude Code manually when ready.\n'));
    return;
  }

  // Attempt to restart Claude Code
  console.log(chalk.gray('\n  Restarting Claude Code...\n'));

  try {
    const isWindows = process.platform === 'win32';

    if (isWindows) {
      spawn('cmd', ['/c', 'start', 'claude'], {
        cwd,
        detached: true,
        stdio: 'ignore',
        shell: true,
      }).unref();
    } else {
      spawn('claude', [], {
        cwd,
        detached: true,
        stdio: 'ignore',
        shell: true,
      }).unref();
    }

    console.log(chalk.green('  ✓ Claude Code is restarting...\n'));
    console.log(chalk.gray('  This terminal will close. Claude Code will open in a new window.\n'));

    await new Promise(resolve => setTimeout(resolve, 1000));
    process.exit(0);

  } catch {
    console.log(chalk.yellow('  Could not auto-restart. Please restart Claude Code manually.\n'));
  }
}

// v6.0 Bootstrap content - minimal files that point to MCP tools
const V6_CLAUDE_MD = `# CodeBakers v6.0 - Server-Enforced Patterns

**All patterns are server-side. No local pattern files needed.**

## Required MCP Tools

Before writing ANY code, you MUST use these CodeBakers MCP tools:

### 1. discover_patterns (MANDATORY - START GATE)
Call this BEFORE writing any code:
\`\`\`
Tool: discover_patterns
Args: { task: "what you're about to do", files: ["files to modify"], keywords: ["relevant terms"] }
\`\`\`
This returns:
- Relevant patterns from the server
- A session token (required for validation)
- Code examples to follow

### 2. validate_complete (MANDATORY - END GATE)
Call this BEFORE saying "done" or "complete":
\`\`\`
Tool: validate_complete
Args: { feature: "what you built", files: ["files modified"] }
\`\`\`
This checks:
- You called discover_patterns first (server verifies)
- Tests exist and pass
- TypeScript compiles
- Returns pass/fail from server

## Rules

1. **You CANNOT skip discover_patterns** - Server tracks compliance
2. **You CANNOT say "done" without validate_complete** - Server must approve
3. **Follow patterns returned by server** - They are mandatory
4. **Write tests** - Validation will fail without them
5. **Fix TypeScript errors** - Validation will fail with errors

## If Server is Unreachable

The tools will show "OFFLINE MODE" if the server can't be reached. In this case:
- Enforcement is limited to local checks only
- You should still follow best practices
- Try again when connection is restored

## Getting Help

- Run \`codebakers doctor\` to diagnose issues
- Run \`codebakers upgrade\` to update patterns
- Visit https://codebakers.ai/support for help

---
*CodeBakers v6.0 - Server-Enforced Patterns*
`;

const V6_CURSORRULES = `# CodeBakers v6.0 - Server-Enforced Patterns

All patterns are server-side. No local pattern files needed.

## Required MCP Tools

Before writing ANY code, you MUST use these CodeBakers MCP tools:

### 1. discover_patterns (MANDATORY - START GATE)
Call this BEFORE writing any code:
- Tool: discover_patterns
- Args: { task: "what you're about to do", files: ["files to modify"], keywords: ["relevant terms"] }

Returns:
- Relevant patterns from the server
- A session token (required for validation)
- Code examples to follow

### 2. validate_complete (MANDATORY - END GATE)
Call this BEFORE saying "done" or "complete":
- Tool: validate_complete
- Args: { feature: "what you built", files: ["files modified"] }

Checks:
- You called discover_patterns first (server verifies)
- Tests exist and pass
- TypeScript compiles
- Returns pass/fail from server

## Rules

1. You CANNOT skip discover_patterns - Server tracks compliance
2. You CANNOT say "done" without validate_complete - Server must approve
3. Follow patterns returned by server - They are mandatory
4. Write tests - Validation will fail without them
5. Fix TypeScript errors - Validation will fail with errors

## If Server is Unreachable

The tools will show "OFFLINE MODE" if the server can't be reached. In this case:
- Enforcement is limited to local checks only
- You should still follow best practices
- Try again when connection is restored

---
CodeBakers v6.0 - Server-Enforced Patterns
`;

/**
 * Install v6.0 bootstrap files for API key users (paid users)
 * Only installs minimal CLAUDE.md and .cursorrules - no .claude/ folder
 */
async function installPatternsWithApiKey(apiKey: string, options: GoOptions = {}): Promise<void> {
  log('Installing v6.0 bootstrap files (API key user)...', options);
  await installBootstrapFiles(options, { apiKey });
}

/**
 * Install v6.0 bootstrap files for trial users
 * Only installs minimal CLAUDE.md and .cursorrules - no .claude/ folder
 */
async function installPatterns(trialId: string, options: GoOptions = {}): Promise<void> {
  log(`Installing v6.0 bootstrap files (trial: ${trialId.substring(0, 8)}...)`, options);
  await installBootstrapFiles(options, { trialId });
}

/**
 * Install v6.0 minimal bootstrap files
 * - CLAUDE.md: Instructions for Claude Code
 * - .cursorrules: Instructions for Cursor
 * - NO .claude/ folder - all patterns are server-side
 */
async function installBootstrapFiles(options: GoOptions = {}, auth?: AuthInfo): Promise<void> {
  const spinner = ora('Installing CodeBakers v6.0...').start();
  const cwd = process.cwd();

  try {
    const claudeMdPath = join(cwd, 'CLAUDE.md');
    const cursorRulesPath = join(cwd, '.cursorrules');

    // Check if already installed with v6
    if (existsSync(claudeMdPath)) {
      const content = readFileSync(claudeMdPath, 'utf-8');
      if (content.includes('v6.0') && content.includes('discover_patterns')) {
        spinner.succeed('CodeBakers v6.0 already installed');
        return;
      }
      // Upgrade from v5
      log('Upgrading from v5 to v6...', options);
    }

    // Write v6.0 bootstrap files
    writeFileSync(claudeMdPath, V6_CLAUDE_MD);
    writeFileSync(cursorRulesPath, V6_CURSORRULES);

    spinner.succeed('CodeBakers v6.0 installed');
    console.log(chalk.gray('  Patterns are server-enforced via MCP tools\n'));

    // Confirm install to server (non-blocking)
    if (auth) {
      const apiUrl = getApiUrl();
      confirmDownload(apiUrl, auth, {
        version: '6.0',
        moduleCount: 0, // No local modules in v6
        cliVersion: getCliVersion(),
        command: 'go',
      }).catch(() => {}); // Silently ignore
    }

  } catch (error) {
    log(`Error: ${error instanceof Error ? error.message : String(error)}`, options);
    spinner.warn('Could not install bootstrap files');
    console.log(chalk.gray('  MCP tools will still work without local files.\n'));
  }
}
