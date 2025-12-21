import chalk from 'chalk';
import { homedir, platform } from 'os';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { getApiKey } from '../config.js';

interface McpConfig {
  mcpServers: {
    [key: string]: {
      command: string;
      args?: string[];
      env?: Record<string, string>;
    };
  };
}

// The MCP server config (shared)
const CODEBAKERS_MCP_CONFIG = {
  command: 'npx',
  args: ['-y', '@codebakers/cli', 'serve'],
};

export async function mcpConfig(options: {
  install?: boolean;
  show?: boolean;
  project?: boolean;
}): Promise<void> {
  console.log(chalk.blue('\n  CodeBakers MCP Configuration\n'));

  const apiKey = getApiKey();
  if (!apiKey) {
    console.log(chalk.red('  Not logged in. Run `codebakers login` first.\n'));
    process.exit(1);
  }

  // Project-level config: create .mcp.json in current directory
  if (options.project) {
    return createProjectConfig();
  }

  // Global install: write to Claude Code's config file
  if (options.install) {
    return installGlobalConfig();
  }

  // Default: show the easy setup instructions
  showSetupInstructions();
}

function showSetupInstructions(): void {
  console.log(chalk.white('  Quick Setup (recommended):\n'));
  console.log(chalk.gray('  Run this command in Claude Code:\n'));
  console.log(chalk.cyan('    /mcp add codebakers npx -y @codebakers/cli serve\n'));
  console.log(chalk.gray('  That\'s it! No restart needed.\n'));

  console.log(chalk.white('  ─────────────────────────────────────\n'));

  console.log(chalk.white('  Alternative Options:\n'));
  console.log(chalk.gray('  • Project-level config (for boilerplates):'));
  console.log(chalk.cyan('      codebakers mcp-config --project\n'));
  console.log(chalk.gray('  • Global install (writes to config file):'));
  console.log(chalk.cyan('      codebakers mcp-config --install\n'));
}

function createProjectConfig(): void {
  const projectConfigPath = join(process.cwd(), '.mcp.json');

  const config: McpConfig = {
    mcpServers: {
      codebakers: CODEBAKERS_MCP_CONFIG,
    },
  };

  try {
    // Check if file already exists
    if (existsSync(projectConfigPath)) {
      // Merge with existing config
      const existing = JSON.parse(readFileSync(projectConfigPath, 'utf-8'));
      if (!existing.mcpServers) {
        existing.mcpServers = {};
      }
      existing.mcpServers.codebakers = CODEBAKERS_MCP_CONFIG;
      writeFileSync(projectConfigPath, JSON.stringify(existing, null, 2));
    } else {
      writeFileSync(projectConfigPath, JSON.stringify(config, null, 2));
    }

    console.log(chalk.green('  Created .mcp.json in current directory!\n'));
    console.log(chalk.gray('  File: .mcp.json'));
    console.log(chalk.gray('  '));
    console.log(chalk.gray('  {'));
    console.log(chalk.gray('    "mcpServers": {'));
    console.log(chalk.yellow('      "codebakers": {'));
    console.log(chalk.yellow(`        "command": "npx",`));
    console.log(chalk.yellow(`        "args": ["-y", "@codebakers/cli", "serve"]`));
    console.log(chalk.yellow('      }'));
    console.log(chalk.gray('    }'));
    console.log(chalk.gray('  }\n'));

    console.log(chalk.white('  How to use:\n'));
    console.log(chalk.gray('  1. Commit .mcp.json to your repo'));
    console.log(chalk.gray('  2. When someone opens the project in Claude Code,'));
    console.log(chalk.gray('     the MCP server starts automatically'));
    console.log(chalk.gray('  3. Patterns are fetched on-demand (never stored locally)\n'));

    console.log(chalk.white('  Requirements:\n'));
    console.log(chalk.gray('  Users must have run `codebakers login` once on their machine.\n'));

    // Also add to .gitignore if it's not a file we want tracked
    // Actually, we DO want .mcp.json tracked so it works for all users
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`\n  Error: ${message}\n`));
    process.exit(1);
  }
}

function installGlobalConfig(): void {
  const home = homedir();
  let configPath: string;

  if (platform() === 'win32') {
    configPath = join(home, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
  } else if (platform() === 'darwin') {
    configPath = join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  } else {
    configPath = join(home, '.config', 'claude', 'claude_desktop_config.json');
  }

  try {
    // Ensure config directory exists
    const configDir = join(configPath, '..');
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    // Read existing config or create new
    let config: McpConfig = { mcpServers: {} };

    if (existsSync(configPath)) {
      try {
        const existing = readFileSync(configPath, 'utf-8');
        config = JSON.parse(existing);
        if (!config.mcpServers) {
          config.mcpServers = {};
        }
      } catch {
        console.log(chalk.yellow('  Existing config is invalid, creating new one.'));
      }
    }

    // Add CodeBakers MCP server
    config.mcpServers.codebakers = CODEBAKERS_MCP_CONFIG;

    // Write config
    writeFileSync(configPath, JSON.stringify(config, null, 2));

    console.log(chalk.green('  MCP configuration installed!\n'));
    console.log(chalk.gray('  Config written to:'));
    console.log(chalk.cyan(`    ${configPath}\n`));
    console.log(chalk.white('  Next step:\n'));
    console.log(chalk.gray('  Restart Claude Code to activate the MCP server.\n'));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`\n  Error: ${message}\n`));
    console.log(chalk.gray('  Try the quick setup instead:\n'));
    console.log(chalk.cyan('    /mcp add codebakers npx -y @codebakers/cli serve\n'));
    process.exit(1);
  }
}

export async function mcpUninstall(): Promise<void> {
  console.log(chalk.blue('\n  Remove CodeBakers MCP Configuration\n'));

  // Check for project-level config
  const projectConfigPath = join(process.cwd(), '.mcp.json');
  if (existsSync(projectConfigPath)) {
    try {
      const existing = JSON.parse(readFileSync(projectConfigPath, 'utf-8'));
      if (existing.mcpServers?.codebakers) {
        delete existing.mcpServers.codebakers;
        if (Object.keys(existing.mcpServers).length === 0) {
          // Remove file if empty
          const { unlinkSync } = await import('fs');
          unlinkSync(projectConfigPath);
          console.log(chalk.green('  Removed .mcp.json (was empty)\n'));
        } else {
          writeFileSync(projectConfigPath, JSON.stringify(existing, null, 2));
          console.log(chalk.green('  Removed codebakers from .mcp.json\n'));
        }
      }
    } catch {
      // Ignore errors with project config
    }
  }

  // Check for global config
  const home = homedir();
  let configPath: string;

  if (platform() === 'win32') {
    configPath = join(home, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
  } else if (platform() === 'darwin') {
    configPath = join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  } else {
    configPath = join(home, '.config', 'claude', 'claude_desktop_config.json');
  }

  if (!existsSync(configPath)) {
    console.log(chalk.gray('  No global MCP configuration found.\n'));
    console.log(chalk.gray('  To remove from Claude Code, run:\n'));
    console.log(chalk.cyan('    /mcp remove codebakers\n'));
    return;
  }

  try {
    const existing = readFileSync(configPath, 'utf-8');
    const config: McpConfig = JSON.parse(existing);

    if (config.mcpServers && config.mcpServers.codebakers) {
      delete config.mcpServers.codebakers;
      writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(chalk.green('  Removed from global config.\n'));
      console.log(chalk.gray('  Restart Claude Code to apply changes.\n'));
    } else {
      console.log(chalk.gray('  CodeBakers not found in global config.\n'));
      console.log(chalk.gray('  To remove from Claude Code, run:\n'));
      console.log(chalk.cyan('    /mcp remove codebakers\n'));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`\n  Error: ${message}\n`));
    process.exit(1);
  }
}
