import chalk from 'chalk';
import ora from 'ora';
import { execSync, spawn } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
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

interface ContentResponse {
  version: string;
  router: string;
  modules: Record<string, string>;
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
 */
export async function go(options: GoOptions = {}): Promise<void> {
  log('Starting go command...', options);
  log(`API URL: ${getApiUrl()}`, options);
  log(`Working directory: ${process.cwd()}`, options);

  console.log(chalk.blue(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   ${chalk.bold.white('CodeBakers - Zero Setup Required')}                    ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
  `));

  // Check if user already has an API key (paid user)
  log('Checking for existing API key...', options);
  const apiKey = getApiKey();
  if (apiKey) {
    log(`Found API key: ${apiKey.substring(0, 8)}...`, options);
    console.log(chalk.green('  ✓ You\'re already logged in with an API key!\n'));

    // Still install patterns if not already installed
    await installPatternsWithApiKey(apiKey, options);
    await configureMCP(options);
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

    // Install patterns (CLAUDE.md and .claude/)
    await installPatterns(data.trialId, options);

    // Configure MCP
    await configureMCP(options);

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

async function attemptAutoRestart(): Promise<void> {
  const cwd = process.cwd();

  console.log(chalk.yellow('\n  ⚠️  RESTART REQUIRED\n'));
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
      // On Windows, spawn a new Claude process detached and exit
      spawn('cmd', ['/c', 'start', 'claude'], {
        cwd,
        detached: true,
        stdio: 'ignore',
        shell: true,
      }).unref();
    } else {
      // On Mac/Linux, spawn claude in new terminal
      spawn('claude', [], {
        cwd,
        detached: true,
        stdio: 'ignore',
        shell: true,
      }).unref();
    }

    console.log(chalk.green('  ✓ Claude Code is restarting...\n'));
    console.log(chalk.gray('  This terminal will close. Claude Code will open in a new window.\n'));

    // Give the spawn a moment to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Exit this process
    process.exit(0);

  } catch (error) {
    console.log(chalk.yellow('  Could not auto-restart. Please restart Claude Code manually.\n'));
  }
}

/**
 * Install pattern files for API key users (paid users)
 */
async function installPatternsWithApiKey(apiKey: string, options: GoOptions = {}): Promise<void> {
  log('Installing patterns with API key...', options);
  const spinner = ora('Installing CodeBakers patterns...').start();
  const cwd = process.cwd();
  const apiUrl = getApiUrl();

  log(`Fetching from: ${apiUrl}/api/content`, options);

  try {
    const response = await fetch(`${apiUrl}/api/content`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      log(`Response not OK: ${response.status} ${response.statusText}`, options);
      spinner.warn('Could not download patterns');
      return;
    }

    log('Response OK, parsing JSON...', options);
    const content: ContentResponse = await response.json();
    log(`Received version: ${content.version}, modules: ${Object.keys(content.modules || {}).length}`, options);
    await writePatternFiles(cwd, content, spinner, options, { apiKey });

  } catch (error) {
    log(`Error: ${error instanceof Error ? error.message : String(error)}`, options);
    spinner.warn('Could not install patterns');
    console.log(chalk.gray('  Check your internet connection.\n'));
  }
}

/**
 * Install pattern files (CLAUDE.md and .claude/) for trial users
 */
async function installPatterns(trialId: string, options: GoOptions = {}): Promise<void> {
  log(`Installing patterns with trial ID: ${trialId.substring(0, 8)}...`, options);
  const spinner = ora('Installing CodeBakers patterns...').start();
  const cwd = process.cwd();
  const apiUrl = getApiUrl();

  try {
    // Fetch patterns using trial ID
    log(`Fetching from: ${apiUrl}/api/content`, options);
    const response = await fetch(`${apiUrl}/api/content`, {
      method: 'GET',
      headers: {
        'X-Trial-ID': trialId,
      },
    });

    if (!response.ok) {
      log(`Primary endpoint failed: ${response.status}, trying trial endpoint...`, options);
      // Try without auth - some patterns may be available for trial
      const publicResponse = await fetch(`${apiUrl}/api/content/trial`, {
        method: 'GET',
        headers: {
          'X-Trial-ID': trialId,
        },
      });

      if (!publicResponse.ok) {
        log(`Trial endpoint also failed: ${publicResponse.status}`, options);
        spinner.warn('Could not download patterns (will use MCP tools)');
        return;
      }

      const content: ContentResponse = await publicResponse.json();
      log(`Received version: ${content.version}, modules: ${Object.keys(content.modules || {}).length}`, options);
      await writePatternFiles(cwd, content, spinner, options, { trialId });
      return;
    }

    const content: ContentResponse = await response.json();
    log(`Received version: ${content.version}, modules: ${Object.keys(content.modules || {}).length}`, options);
    await writePatternFiles(cwd, content, spinner, options, { trialId });

  } catch (error) {
    log(`Error: ${error instanceof Error ? error.message : String(error)}`, options);
    spinner.warn('Could not install patterns (will use MCP tools)');
    console.log(chalk.gray('  Patterns will be available via MCP tools.\n'));
  }
}

async function writePatternFiles(
  cwd: string,
  content: ContentResponse,
  spinner: ReturnType<typeof ora>,
  options: GoOptions = {},
  auth?: AuthInfo
): Promise<void> {
  log(`Writing pattern files to ${cwd}...`, options);
  // Check if patterns already exist
  const claudeMdPath = join(cwd, 'CLAUDE.md');
  if (existsSync(claudeMdPath)) {
    spinner.succeed('CodeBakers patterns already installed');
    return;
  }

  // Write CLAUDE.md (router file)
  if (content.router) {
    writeFileSync(claudeMdPath, content.router);
  }

  // Write pattern modules to .claude/
  const moduleCount = Object.keys(content.modules || {}).length;
  if (content.modules && moduleCount > 0) {
    const modulesDir = join(cwd, '.claude');
    if (!existsSync(modulesDir)) {
      mkdirSync(modulesDir, { recursive: true });
    }

    for (const [name, data] of Object.entries(content.modules)) {
      writeFileSync(join(modulesDir, name), data);
    }
  }

  // Update .gitignore to exclude encoded patterns
  const gitignorePath = join(cwd, '.gitignore');
  if (existsSync(gitignorePath)) {
    const { readFileSync } = await import('fs');
    const gitignore = readFileSync(gitignorePath, 'utf-8');
    if (!gitignore.includes('.claude/')) {
      writeFileSync(gitignorePath, gitignore + '\n# CodeBakers patterns\n.claude/\n');
    }
  }

  spinner.succeed(`CodeBakers patterns installed (v${content.version})`);
  console.log(chalk.gray(`  ${moduleCount} pattern modules ready\n`));

  // Confirm download to server (non-blocking)
  if (auth) {
    const apiUrl = getApiUrl();
    confirmDownload(apiUrl, auth, {
      version: content.version,
      moduleCount,
      cliVersion: getCliVersion(),
      command: 'go',
    }).catch(() => {}); // Silently ignore
  }
}
