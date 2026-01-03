import chalk from 'chalk';
import ora from 'ora';
import { existsSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { getApiKey } from '../config.js';
import { checkForUpdates, getCliVersion } from '../lib/api.js';

// Bootstrap files - patterns come from server via MCP
const CLAUDE_MD_BOOTSTRAP = `# CodeBakers

**MANDATORY: Before writing ANY code, call the \`discover_patterns\` MCP tool.**

\`\`\`
Tool: discover_patterns
Args: { task: "description of what you're building" }
\`\`\`

The server will return:
- All coding patterns and rules you must follow
- Test requirements
- Validation instructions

**You cannot write code without calling this tool first. The server tracks compliance.**
`;

const CURSORRULES_BOOTSTRAP = `# CodeBakers

MANDATORY: Before writing ANY code, call the discover_patterns MCP tool.

Tool: discover_patterns
Args: { task: "description of what you're building" }

The server returns all patterns, rules, and test requirements.
You cannot write code without calling this tool first.
`;

/**
 * Check if project is using server-enforced mode
 */
function isServerEnforced(cwd: string): boolean {
  const stateFile = join(cwd, '.codebakers.json');
  if (existsSync(stateFile)) {
    try {
      const state = JSON.parse(readFileSync(stateFile, 'utf-8'));
      return state.serverEnforced === true;
    } catch {
      // Ignore parse errors
    }
  }
  return false;
}

/**
 * Migrate project to server-enforced mode
 */
function migrateToServerEnforced(cwd: string): void {
  console.log(chalk.yellow('\n  📦 Upgrading to server-enforced patterns...\n'));

  // Update CLAUDE.md
  const claudeMdPath = join(cwd, 'CLAUDE.md');
  writeFileSync(claudeMdPath, CLAUDE_MD_BOOTSTRAP);
  console.log(chalk.green('  ✓ Updated CLAUDE.md'));

  // Update .cursorrules
  const cursorrules = join(cwd, '.cursorrules');
  writeFileSync(cursorrules, CURSORRULES_BOOTSTRAP);
  console.log(chalk.green('  ✓ Updated .cursorrules'));

  // Remove old .claude folder if it exists (patterns now come from server)
  const claudeDir = join(cwd, '.claude');
  if (existsSync(claudeDir)) {
    try {
      rmSync(claudeDir, { recursive: true, force: true });
      console.log(chalk.green('  ✓ Removed .claude/ folder (patterns now server-side)'));
    } catch {
      console.log(chalk.yellow('  ⚠️  Could not remove .claude/ folder - please delete manually'));
    }
  }

  // Update .codebakers.json
  const stateFile = join(cwd, '.codebakers.json');
  let state: Record<string, unknown> = {};
  if (existsSync(stateFile)) {
    try {
      state = JSON.parse(readFileSync(stateFile, 'utf-8'));
    } catch {
      // Ignore errors
    }
  }
  state.migratedAt = new Date().toISOString();
  state.serverEnforced = true;
  writeFileSync(stateFile, JSON.stringify(state, null, 2));

  console.log(chalk.green('\n  ✅ Upgrade complete!\n'));
  console.log(chalk.cyan('  What changed:'));
  console.log(chalk.gray('  - Patterns are now fetched from server in real-time'));
  console.log(chalk.gray('  - AI calls discover_patterns before coding'));
  console.log(chalk.gray('  - No local pattern files needed'));
  console.log(chalk.gray('  - Always up-to-date patterns\n'));
}

/**
 * Upgrade CodeBakers - checks for CLI updates and ensures server-enforced setup
 */
export async function upgrade(): Promise<void> {
  console.log(chalk.blue('\n  CodeBakers Upgrade\n'));

  const cwd = process.cwd();
  const claudeMdPath = join(cwd, 'CLAUDE.md');
  const codebakersJson = join(cwd, '.codebakers.json');

  // Check if this is a CodeBakers project
  if (!existsSync(claudeMdPath) && !existsSync(codebakersJson)) {
    console.log(chalk.yellow('  No CodeBakers installation found in this directory.\n'));
    console.log(chalk.gray('  Run `codebakers init` to set up CodeBakers first.\n'));
    return;
  }

  // Check for CLI updates
  const spinner = ora('Checking for CLI updates...').start();

  try {
    const updateInfo = await checkForUpdates();

    if (updateInfo?.updateAvailable) {
      spinner.succeed('CLI update available!');
      console.log(chalk.yellow(`\n  ⚠️  New CLI version: ${updateInfo.currentVersion} → ${updateInfo.latestVersion}`));
      console.log(chalk.cyan('  Run: npm install -g @codebakers/cli@latest\n'));
    } else {
      spinner.succeed(`CLI is up to date (v${getCliVersion()})`);
    }
  } catch {
    spinner.warn('Could not check for CLI updates');
  }

  // Check API key
  const apiKey = getApiKey();
  if (!apiKey) {
    console.log(chalk.yellow('\n  Not logged in. Run `codebakers login` to authenticate.\n'));
  } else {
    console.log(chalk.green('  ✓ Logged in\n'));
  }

  // Check if already using server-enforced patterns
  if (isServerEnforced(cwd)) {
    console.log(chalk.green('  ✅ Already using server-enforced patterns!\n'));
    console.log(chalk.gray('  Patterns are fetched from server in real-time.'));
    console.log(chalk.gray('  AI calls discover_patterns before coding - always up to date.\n'));
    return;
  }

  // Migrate to server-enforced mode
  migrateToServerEnforced(cwd);
}
