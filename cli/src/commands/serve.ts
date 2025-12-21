import chalk from 'chalk';
import { getApiKey } from '../config.js';

export async function serve(): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error(chalk.red('\n  Not logged in. Run `codebakers login` first.\n'));
    process.exit(1);
  }

  // Log to stderr so it doesn't interfere with MCP stdio protocol
  console.error(chalk.blue('\n  CodeBakers MCP Server\n'));
  console.error(chalk.green('  Starting MCP server on stdio...'));
  console.error(chalk.gray('  This server provides pattern tools to Claude Code.\n'));
  console.error(chalk.gray('  Available tools:'));
  console.error(chalk.gray('    - get_pattern: Fetch a single pattern'));
  console.error(chalk.gray('    - list_patterns: List all available patterns'));
  console.error(chalk.gray('    - get_patterns: Fetch multiple patterns\n'));

  // Dynamically import and run the MCP server
  const { runServer } = await import('../mcp/server.js');
  await runServer();
}
