import chalk from 'chalk';
import ora from 'ora';
import { writeFileSync, existsSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { getApiKey } from '../config.js';
import { getCliVersion } from '../lib/api.js';

// Bootstrap files - patterns come from server via MCP
const CLAUDE_MD_BOOTSTRAP = `# CodeBakers

**MANDATORY: Before writing ANY code, call the \`discover_patterns\` MCP tool.**

Tool: discover_patterns
Args: { task: "description of what you're building" }

The server will return:
- All coding patterns and rules you must follow
- Test requirements
- Validation instructions

**You cannot write code without calling this tool first. The server tracks compliance.**
`;

const CURSORRULES_BOOTSTRAP = `# CodeBakers

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
  console.log(chalk.blue('\n  CodeBakers Install\n'));

  const apiKey = getApiKey();
  if (!apiKey) {
    console.log(chalk.red('  Not logged in. Run `codebakers login` first.\n'));
    process.exit(1);
  }

  const spinner = ora('Installing CodeBakers...').start();

  try {
    const cwd = process.cwd();
    const claudeMdPath = join(cwd, 'CLAUDE.md');
    const cursorRulesPath = join(cwd, '.cursorrules');
    const claudeDir = join(cwd, '.claude');

    // Remove old .claude folder if it exists (patterns now server-side)
    if (existsSync(claudeDir)) {
      spinner.text = 'Removing old pattern files...';
      rmSync(claudeDir, { recursive: true, force: true });
    }

    // Write bootstrap files
    writeFileSync(claudeMdPath, CLAUDE_MD_BOOTSTRAP);
    writeFileSync(cursorRulesPath, CURSORRULES_BOOTSTRAP);

    // Add .cursorrules to .gitignore if not present
    const gitignorePath = join(cwd, '.gitignore');
    if (existsSync(gitignorePath)) {
      const gitignore = readFileSync(gitignorePath, 'utf-8');
      if (!gitignore.includes('.cursorrules')) {
        const additions = '\n# CodeBakers\n.cursorrules\n';
        writeFileSync(gitignorePath, gitignore + additions);
      }
    }

    spinner.succeed('CodeBakers installed!');

    console.log(chalk.gray('\n  Files created:'));
    console.log(chalk.gray('    - CLAUDE.md (Claude Code gateway)'));
    console.log(chalk.gray('    - .cursorrules (Cursor IDE gateway)'));

    console.log(chalk.cyan('\n  How it works:'));
    console.log(chalk.gray('    - Patterns are fetched from server in real-time'));
    console.log(chalk.gray('    - AI calls discover_patterns before coding'));
    console.log(chalk.gray('    - Always up-to-date, no manual updates needed'));

    console.log(chalk.gray(`\n  CLI version: ${getCliVersion()}`));
    console.log(chalk.blue('\n  Start building! AI will fetch patterns via MCP.\n'));
  } catch (error) {
    spinner.fail('Installation failed');
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`\n  Error: ${message}\n`));
    process.exit(1);
  }
}
