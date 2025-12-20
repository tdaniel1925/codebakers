import chalk from 'chalk';
import ora from 'ora';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Enhanced hook with pre-flight checks and self-review automation
const HOOK_TEMPLATE = {
  hooks: {
    UserPromptSubmit: [
      {
        type: "command",
        command: `echo '════════════════════════════════════════════════════════════════
🚀 CODEBAKERS ZERO-FRICTION PROTOCOL
════════════════════════════════════════════════════════════════

AUTOMATIC WORKFLOW - Execute silently, output only the acknowledgment:

▸ PHASE 1: CONTEXT LOAD
  Read these files (if they exist):
  - CLAUDE.md → Router & module instructions
  - PRD.md → What we are building (requirements!)
  - PROJECT-CONTEXT.md → Codebase knowledge
  - PROJECT-STATE.md → What is in progress
  - DECISIONS.md → Past architectural choices

▸ PHASE 2: PRE-FLIGHT CHECK (before writing code)
  □ What existing code does this touch?
  □ Is similar code in the codebase? (copy that pattern!)
  □ Whats the data model?
  □ What are the error cases?
  □ Is someone else working on this? (check In Progress)

  If PROJECT-CONTEXT.md is empty/stale, SCAN PROJECT FIRST:
  - Read package.json
  - Check file structure
  - Find existing patterns
  - Update PROJECT-CONTEXT.md

▸ PHASE 3: ACKNOWLEDGE & EXECUTE
  Output: 📋 CodeBakers | [Type] | Modules: [list]
  Then: Follow patterns from .claude/ folder EXACTLY

▸ PHASE 4: SELF-REVIEW (before saying done)
  □ TypeScript compiles? (npx tsc --noEmit)
  □ Imports resolve?
  □ Error handling exists?
  □ Matches existing patterns?
  □ Tests written?

  If ANY fails → FIX before responding

▸ PHASE 5: UPDATE STATE
  - Update PROJECT-STATE.md (move to Completed)
  - Add to DECISIONS.md if architectural choice made

════════════════════════════════════════════════════════════════
🔄 MULTI-AGENT MODE
════════════════════════════════════════════════════════════════
- Check PROJECT-STATE.md "In Progress" - dont duplicate work
- Add YOUR task to In Progress when starting
- If conflict → STOP and ask user

════════════════════════════════════════════════════════════════
💡 REMEMBER: Check existing code FIRST. Copy patterns. Validate.
════════════════════════════════════════════════════════════════'`
      }
    ]
  }
};

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

    // Merge hook into settings
    settings.hooks = settings.hooks || {};
    (settings.hooks as Record<string, unknown>).UserPromptSubmit = HOOK_TEMPLATE.hooks.UserPromptSubmit;

    // Write back
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    spinner.succeed('Hook installed successfully!');

    console.log(chalk.white('\n  What happens automatically on EVERY message:\n'));
    console.log(chalk.gray('    ✓ Loads project context (CLAUDE.md, PROJECT-CONTEXT.md)'));
    console.log(chalk.gray('    ✓ Checks what\'s in progress (PROJECT-STATE.md)'));
    console.log(chalk.gray('    ✓ Runs pre-flight checks before coding'));
    console.log(chalk.gray('    ✓ Copies existing patterns from your codebase'));
    console.log(chalk.gray('    ✓ Self-reviews code before outputting'));
    console.log(chalk.gray('    ✓ Updates project state when done'));
    console.log(chalk.gray('    ✓ Logs architectural decisions\n'));

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

    if (!settings.hooks?.UserPromptSubmit) {
      spinner.info('No UserPromptSubmit hook found. Nothing to remove.');
      return;
    }

    // Remove the hook
    delete settings.hooks.UserPromptSubmit;

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
