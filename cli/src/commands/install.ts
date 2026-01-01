import chalk from 'chalk';
import ora from 'ora';
import { writeFileSync, existsSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { getApiKey } from '../config.js';
import { getCliVersion } from '../lib/api.js';

// v6.0 Bootstrap files - patterns come from server via MCP
const V6_CLAUDE_MD = `# CodeBakers v6.0

**MANDATORY: Before writing ANY code, call the \`discover_patterns\` MCP tool.**

Tool: discover_patterns
Args: { task: "description of what you're building" }

The server will return:
- All coding patterns and rules you must follow
- Test requirements
- Validation instructions

**You cannot write code without calling this tool first. The server tracks compliance.**
`;

const V6_CURSORRULES = `# CodeBakers v6.0

**MANDATORY: Before writing ANY code, call the \`discover_patterns\` MCP tool.**

Tool: discover_patterns
Args: { task: "description of what you're building" }

The server will return:
- All coding patterns and rules you must follow
- Test requirements
- Validation instructions

**You cannot write code without calling this tool first. The server tracks compliance.**
`;

export async function install(): Promise<void> {
  console.log(chalk.blue('\n  CodeBakers Install (v6.0)\n'));

  const apiKey = getApiKey();
  if (!apiKey) {
    console.log(chalk.red('  Not logged in. Run `codebakers login` first.\n'));
    process.exit(1);
  }

  const spinner = ora('Installing CodeBakers v6.0...').start();

  try {
    const cwd = process.cwd();
    const claudeMdPath = join(cwd, 'CLAUDE.md');
    const cursorRulesPath = join(cwd, '.cursorrules');
    const claudeDir = join(cwd, '.claude');

    // Check for existing v5 installation and migrate
    if (existsSync(claudeDir)) {
      spinner.text = 'Migrating from v5 to v6...';
      rmSync(claudeDir, { recursive: true, force: true });
    }

    // Write v6 bootstrap files
    writeFileSync(claudeMdPath, V6_CLAUDE_MD);
    writeFileSync(cursorRulesPath, V6_CURSORRULES);

    // Add .cursorrules to .gitignore if not present
    const gitignorePath = join(cwd, '.gitignore');
    if (existsSync(gitignorePath)) {
      const gitignore = readFileSync(gitignorePath, 'utf-8');
      if (!gitignore.includes('.cursorrules')) {
        const additions = '\n# CodeBakers\n.cursorrules\n';
        writeFileSync(gitignorePath, gitignore + additions);
      }
    }

    spinner.succeed('CodeBakers v6.0 installed!');

    console.log(chalk.gray('\n  Files created:'));
    console.log(chalk.gray('    - CLAUDE.md (Claude Code gateway)'));
    console.log(chalk.gray('    - .cursorrules (Cursor IDE gateway)'));

    console.log(chalk.cyan('\n  What\'s new in v6.0:'));
    console.log(chalk.gray('    - Patterns are now server-side'));
    console.log(chalk.gray('    - AI calls discover_patterns before coding'));
    console.log(chalk.gray('    - Real-time pattern updates'));
    console.log(chalk.gray('    - Usage tracking & compliance'));

    console.log(chalk.gray(`\n  CLI version: ${getCliVersion()}`));
    console.log(chalk.blue('\n  Start building! AI will fetch patterns via MCP.\n'));
  } catch (error) {
    spinner.fail('Installation failed');
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`\n  Error: ${message}\n`));
    process.exit(1);
  }
}
