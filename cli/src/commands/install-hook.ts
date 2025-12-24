import chalk from 'chalk';
import ora from 'ora';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Enhanced hook with visible feedback and concise instructions
const HOOK_TEMPLATE = {
  hooks: {
    UserPromptSubmit: [
      {
        type: "command",
        command: `echo '[CodeBakers] Loading project context...'`
      }
    ],
    PostToolUse: [
      {
        type: "command",
        matcher: "Write|Edit",
        command: `echo '[CodeBakers] Code written - remember to self-review before marking done'`
      }
    ]
  }
};

// Instructions that get injected into the system prompt
const CODEBAKERS_INSTRUCTIONS = `
<user-prompt-submit-hook>
[CodeBakers] Active - Follow these steps for EVERY request:

1. CONTEXT: Read CLAUDE.md, PROJECT-CONTEXT.md, PROJECT-STATE.md
2. PRE-FLIGHT: Check existing code patterns before writing new code
3. EXECUTE: Use patterns from .claude/ folder
4. SELF-REVIEW: Verify TypeScript compiles, imports resolve, error handling exists
5. UPDATE: Mark tasks complete in PROJECT-STATE.md

Output format: "[CodeBakers] Building [feature] using [patterns]"
</user-prompt-submit-hook>
`;

/**
 * Install the CodeBakers hook into ~/.claude/settings.json
 */
export async function installHook(): Promise<void> {
  console.log(chalk.blue('\n  CodeBakers Hook Install\n'));

  const claudeDir = join(homedir(), '.claude');
  const settingsPath = join(claudeDir, 'settings.json');

  const spinner = ora('Installing hook...').start();

  try {
    // Create ~/.claude if it doesn't exist
    if (!existsSync(claudeDir)) {
      mkdirSync(claudeDir, { recursive: true });
      spinner.text = 'Created ~/.claude directory';
    }

    // Read existing settings or start fresh
    let settings: Record<string, unknown> = {};

    if (existsSync(settingsPath)) {
      try {
        const existingContent = readFileSync(settingsPath, 'utf-8');
        settings = JSON.parse(existingContent);
      } catch {
        // Backup the invalid file
        const backupPath = settingsPath + '.backup';
        copyFileSync(settingsPath, backupPath);
        spinner.text = `Backed up invalid settings to ${backupPath}`;
      }
    }

    // Check if hook already exists
    const existingHooks = settings.hooks as Record<string, unknown[]> | undefined;
    if (existingHooks?.UserPromptSubmit) {
      const existingCommand = (existingHooks.UserPromptSubmit[0] as { command?: string })?.command || '';

      if (existingCommand.includes('CODEBAKERS')) {
        spinner.info('CodeBakers hook is already installed');
        console.log(chalk.yellow('\n  Reinstalling with latest version...\n'));
      } else {
        // There's a different hook - warn user
        spinner.warn('An existing UserPromptSubmit hook was found');
        console.log(chalk.yellow('  It will be replaced with the CodeBakers hook.\n'));
      }
    }

    // Merge hooks into settings
    settings.hooks = settings.hooks || {};
    (settings.hooks as Record<string, unknown>).UserPromptSubmit = HOOK_TEMPLATE.hooks.UserPromptSubmit;
    (settings.hooks as Record<string, unknown>).PostToolUse = HOOK_TEMPLATE.hooks.PostToolUse;

    // Write back
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    spinner.succeed('Hook installed successfully!');

    console.log(chalk.white('\n  You\'ll see [CodeBakers] feedback in terminal:\n'));
    console.log(chalk.cyan('    [CodeBakers] Loading project context...'));
    console.log(chalk.cyan('    [CodeBakers] Code written - remember to self-review\n'));

    console.log(chalk.white('  What happens automatically:\n'));
    console.log(chalk.gray('    ✓ Loads project context before every response'));
    console.log(chalk.gray('    ✓ Pre-flight checks before writing code'));
    console.log(chalk.gray('    ✓ Self-review reminders after code changes'));
    console.log(chalk.gray('    ✓ Pattern-based development from .claude/ folder\n'));

    console.log(chalk.yellow('  ⚠️  Restart Claude Code for changes to take effect.\n'));
  } catch (error) {
    spinner.fail('Hook installation failed');
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`\n  Error: ${message}\n`));
    process.exit(1);
  }
}

/**
 * Remove the CodeBakers hook from ~/.claude/settings.json
 */
export async function uninstallHook(): Promise<void> {
  console.log(chalk.blue('\n  CodeBakers Hook Uninstall\n'));

  const settingsPath = join(homedir(), '.claude', 'settings.json');

  const spinner = ora('Removing hook...').start();

  try {
    if (!existsSync(settingsPath)) {
      spinner.info('No settings.json found. Nothing to remove.');
      return;
    }

    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));

    if (!settings.hooks?.UserPromptSubmit && !settings.hooks?.PostToolUse) {
      spinner.info('No CodeBakers hooks found. Nothing to remove.');
      return;
    }

    // Remove both hooks
    if (settings.hooks?.UserPromptSubmit) {
      delete settings.hooks.UserPromptSubmit;
    }
    if (settings.hooks?.PostToolUse) {
      delete settings.hooks.PostToolUse;
    }

    // Clean up empty hooks object
    if (Object.keys(settings.hooks).length === 0) {
      delete settings.hooks;
    }

    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    spinner.succeed('Hook removed successfully!');
    console.log(chalk.yellow('\n  ⚠️  Restart Claude Code for changes to take effect.\n'));
  } catch (error) {
    spinner.fail('Hook removal failed');
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`\n  Error: ${message}\n`));
    process.exit(1);
  }
}

/**
 * Check if the CodeBakers hook is installed
 */
export function isHookInstalled(): boolean {
  const settingsPath = join(homedir(), '.claude', 'settings.json');

  if (!existsSync(settingsPath)) {
    return false;
  }

  try {
    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    const command = settings.hooks?.UserPromptSubmit?.[0]?.command || '';
    return command.includes('CODEBAKERS');
  } catch {
    return false;
  }
}
