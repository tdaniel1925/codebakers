import chalk from 'chalk';
import ora from 'ora';
import { createInterface } from 'readline';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { getApiUrl, getApiKey } from '../config.js';

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

interface PushOptions {
  version: string;
  changelog?: string;
  autoPublish?: boolean;
  sourcePath?: string;
}

interface ModulesContent {
  [key: string]: string;
}

/**
 * Read all module files from a directory
 */
function readModulesFromDir(dirPath: string): ModulesContent {
  const modules: ModulesContent = {};

  if (!existsSync(dirPath)) {
    return modules;
  }

  const files = readdirSync(dirPath).filter(f => f.endsWith('.md'));

  for (const file of files) {
    const filePath = join(dirPath, file);
    const content = readFileSync(filePath, 'utf-8');
    const moduleName = basename(file, '.md');
    modules[moduleName] = content;
  }

  return modules;
}

/**
 * Push patterns to the server via admin API
 */
export async function pushPatterns(options: PushOptions): Promise<void> {
  console.log(chalk.blue('\n  CodeBakers Push Patterns\n'));

  const sourcePath = options.sourcePath || process.cwd();

  // Check for API key - first from config, then from environment
  const apiKey = getApiKey() || process.env.CODEBAKERS_ADMIN_KEY;
  if (!apiKey) {
    console.log(chalk.red('  ✗ No API key found\n'));
    console.log(chalk.gray('  Either:'));
    console.log(chalk.cyan('    1. Run `codebakers setup` to configure your API key'));
    console.log(chalk.cyan('    2. Set CODEBAKERS_ADMIN_KEY environment variable\n'));
    process.exit(1);
  }

  // Read main files
  const claudeMdPath = join(sourcePath, 'CLAUDE.md');
  const cursorRulesPath = join(sourcePath, '.cursorrules');

  let claudeMdContent: string | null = null;
  let cursorRulesContent: string | null = null;

  if (existsSync(claudeMdPath)) {
    claudeMdContent = readFileSync(claudeMdPath, 'utf-8');
    console.log(chalk.green(`  ✓ Found CLAUDE.md (${(claudeMdContent.length / 1024).toFixed(1)} KB)`));
  } else {
    console.log(chalk.yellow(`  ⚠ CLAUDE.md not found at ${claudeMdPath}`));
  }

  if (existsSync(cursorRulesPath)) {
    cursorRulesContent = readFileSync(cursorRulesPath, 'utf-8');
    console.log(chalk.green(`  ✓ Found .cursorrules (${(cursorRulesContent.length / 1024).toFixed(1)} KB)`));
  } else {
    console.log(chalk.yellow(`  ⚠ .cursorrules not found at ${cursorRulesPath}`));
  }

  if (!claudeMdContent && !cursorRulesContent) {
    console.log(chalk.red('\n  ✗ No pattern files found. Nothing to push.\n'));
    process.exit(1);
  }

  // Read module directories
  const claudeModulesPath = join(sourcePath, '.claude');
  const cursorModulesPath = join(sourcePath, '.cursorrules-modules');

  const modulesContent = readModulesFromDir(claudeModulesPath);
  const cursorModulesContent = readModulesFromDir(cursorModulesPath);

  const claudeModuleCount = Object.keys(modulesContent).length;
  const cursorModuleCount = Object.keys(cursorModulesContent).length;

  if (claudeModuleCount > 0) {
    console.log(chalk.green(`  ✓ Found ${claudeModuleCount} Claude modules in .claude/`));
  }

  if (cursorModuleCount > 0) {
    console.log(chalk.green(`  ✓ Found ${cursorModuleCount} Cursor modules in .cursorrules-modules/`));
  }

  console.log('');

  // Show summary
  console.log(chalk.white('  Push Summary:\n'));
  console.log(chalk.gray(`    Version:      ${chalk.cyan(options.version)}`));
  console.log(chalk.gray(`    Auto-publish: ${options.autoPublish ? chalk.green('Yes') : chalk.yellow('No')}`));
  if (options.changelog) {
    console.log(chalk.gray(`    Changelog:    ${chalk.dim(options.changelog.slice(0, 60))}...`));
  }
  console.log('');

  // Files to upload
  console.log(chalk.white('  Files to upload:\n'));
  if (claudeMdContent) console.log(chalk.cyan('    • CLAUDE.md'));
  if (cursorRulesContent) console.log(chalk.cyan('    • .cursorrules'));
  for (const mod of Object.keys(modulesContent)) {
    console.log(chalk.dim(`    • .claude/${mod}.md`));
  }
  for (const mod of Object.keys(cursorModulesContent)) {
    console.log(chalk.dim(`    • .cursorrules-modules/${mod}.md`));
  }
  console.log('');

  // Confirm
  const confirm = await prompt(chalk.gray('  Push these patterns? (y/N): '));
  if (confirm.toLowerCase() !== 'y') {
    console.log(chalk.gray('\n  Cancelled.\n'));
    process.exit(0);
  }

  // Push to server
  const spinner = ora('Pushing patterns to server...').start();

  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/admin/content/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        version: options.version,
        claudeMdContent,
        cursorRulesContent,
        modulesContent: claudeModuleCount > 0 ? modulesContent : undefined,
        cursorModulesContent: cursorModuleCount > 0 ? cursorModulesContent : undefined,
        changelog: options.changelog,
        autoPublish: options.autoPublish,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      spinner.fail(chalk.red(`Push failed: ${data.error || 'Unknown error'}`));
      process.exit(1);
    }

    spinner.succeed(chalk.green('Patterns pushed successfully!'));

    console.log(chalk.white('\n  Result:\n'));
    console.log(chalk.gray(`    Version ID:  ${chalk.cyan(data.version?.id || 'N/A')}`));
    console.log(chalk.gray(`    Version:     ${chalk.cyan(data.version?.version || options.version)}`));
    console.log(chalk.gray(`    Published:   ${data.published ? chalk.green('Yes') : chalk.yellow('No - run publish manually')}`));
    console.log('');
    console.log(chalk.green(`  ${data.message}\n`));

  } catch (error) {
    spinner.fail(chalk.red('Failed to connect to server'));
    console.log(chalk.gray(`\n  Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`));
    process.exit(1);
  }
}

/**
 * Interactive push command
 */
export async function pushPatternsInteractive(): Promise<void> {
  console.log(chalk.blue('\n  CodeBakers Push Patterns\n'));

  // Get version
  const version = await prompt(chalk.cyan('  Version (e.g., 4.5): '));
  if (!version) {
    console.log(chalk.red('\n  Version is required.\n'));
    process.exit(1);
  }

  // Get changelog
  const changelog = await prompt(chalk.cyan('  Changelog (optional): '));

  // Ask about auto-publish
  const autoPublishAnswer = await prompt(chalk.cyan('  Auto-publish? (y/N): '));
  const autoPublish = autoPublishAnswer.toLowerCase() === 'y';

  // Get source path
  const sourcePathAnswer = await prompt(chalk.cyan('  Source path (Enter for current directory): '));
  const sourcePath = sourcePathAnswer || process.cwd();

  await pushPatterns({
    version,
    changelog: changelog || undefined,
    autoPublish,
    sourcePath,
  });
}
