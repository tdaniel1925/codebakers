import chalk from 'chalk';
import { createInterface } from 'readline';
import {
  getApiKey,
  getApiUrl,
  setApiUrl,
  clearApiKey,
  getConfigPath,
  getConfigStore,
  getConfiguredServiceKeys,
  clearAllServiceKeys,
  getLastKeySync,
  SERVICE_KEY_LABELS,
  SERVICE_KEY_CATEGORIES,
  type ServiceName,
} from '../config.js';

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

/**
 * View or modify CLI configuration
 */
export async function config(action?: string): Promise<void> {
  console.log(chalk.blue('\n  CodeBakers Configuration\n'));

  switch (action) {
    case 'show':
    case undefined:
      showConfig();
      break;
    case 'path':
      showConfigPath();
      break;
    case 'reset':
      await resetConfig();
      break;
    case 'keys':
      showServiceKeys();
      break;
    case 'clear-keys':
      await clearKeys();
      break;
    case 'set-url':
      await setUrl();
      break;
    default:
      showHelp();
  }
}

function showConfig(): void {
  const apiKey = getApiKey();
  const apiUrl = getApiUrl();
  const configPath = getConfigPath();
  const configuredKeys = getConfiguredServiceKeys();
  const lastSync = getLastKeySync();

  console.log(chalk.white('  Current Configuration:\n'));

  // API Key
  if (apiKey) {
    const masked = `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}`;
    console.log(chalk.gray('  API Key:        ') + chalk.green(masked));
  } else {
    console.log(chalk.gray('  API Key:        ') + chalk.yellow('Not configured'));
  }

  // API URL
  console.log(chalk.gray('  API URL:        ') + chalk.cyan(apiUrl));

  // Service Keys
  console.log(chalk.gray('  Service Keys:   ') + chalk.cyan(`${configuredKeys.length} configured`));

  // Last Sync
  if (lastSync) {
    const syncDate = lastSync.toLocaleDateString();
    const syncTime = lastSync.toLocaleTimeString();
    console.log(chalk.gray('  Last Sync:      ') + chalk.cyan(`${syncDate} ${syncTime}`));
  } else {
    console.log(chalk.gray('  Last Sync:      ') + chalk.yellow('Never'));
  }

  // Config Path
  console.log(chalk.gray('  Config File:    ') + chalk.dim(configPath));

  console.log('');

  // Show available actions
  console.log(chalk.white('  Available Actions:\n'));
  console.log(chalk.gray('    codebakers config path       ') + chalk.dim('Show config file location'));
  console.log(chalk.gray('    codebakers config keys       ') + chalk.dim('Show configured service keys'));
  console.log(chalk.gray('    codebakers config clear-keys ') + chalk.dim('Clear all service keys'));
  console.log(chalk.gray('    codebakers config set-url    ') + chalk.dim('Change API URL (advanced)'));
  console.log(chalk.gray('    codebakers config reset      ') + chalk.dim('Reset all configuration'));
  console.log('');
}

function showConfigPath(): void {
  const configPath = getConfigPath();
  console.log(chalk.white('  Config file location:\n'));
  console.log(chalk.cyan(`  ${configPath}\n`));
}

function showServiceKeys(): void {
  const configuredKeys = getConfiguredServiceKeys();

  if (configuredKeys.length === 0) {
    console.log(chalk.yellow('  No service keys configured.\n'));
    console.log(chalk.gray('  Add keys in your CodeBakers dashboard, then run `codebakers setup` to sync.\n'));
    return;
  }

  console.log(chalk.white(`  Configured Service Keys (${configuredKeys.length}):\n`));

  // Group by category
  for (const [category, keyNames] of Object.entries(SERVICE_KEY_CATEGORIES)) {
    const categoryKeys = keyNames.filter(k => configuredKeys.includes(k));

    if (categoryKeys.length > 0) {
      console.log(chalk.gray(`  ${category.charAt(0).toUpperCase() + category.slice(1)}:`));
      for (const keyName of categoryKeys) {
        console.log(chalk.green(`    ✓ ${SERVICE_KEY_LABELS[keyName as ServiceName]}`));
      }
    }
  }

  console.log('');

  const lastSync = getLastKeySync();
  if (lastSync) {
    console.log(chalk.gray(`  Last synced: ${lastSync.toLocaleString()}\n`));
  }
}

async function clearKeys(): Promise<void> {
  console.log(chalk.yellow('  This will clear all locally stored service keys.\n'));
  const confirm = await prompt(chalk.gray('  Are you sure? (y/N): '));

  if (confirm.toLowerCase() !== 'y') {
    console.log(chalk.gray('\n  Cancelled.\n'));
    return;
  }

  clearAllServiceKeys();
  console.log(chalk.green('\n  ✓ All service keys cleared.\n'));
  console.log(chalk.gray('  Run `codebakers setup` to sync keys from your account.\n'));
}

async function setUrl(): Promise<void> {
  console.log(chalk.yellow('  ⚠️  This is an advanced setting. Only change if instructed.\n'));

  const currentUrl = getApiUrl();
  console.log(chalk.gray(`  Current URL: ${currentUrl}\n`));

  const newUrl = await prompt(chalk.cyan('  New API URL (or press Enter to cancel): '));

  if (!newUrl) {
    console.log(chalk.gray('\n  Cancelled.\n'));
    return;
  }

  // Basic validation
  try {
    new URL(newUrl);
  } catch {
    console.log(chalk.red('\n  Invalid URL format.\n'));
    return;
  }

  setApiUrl(newUrl);
  console.log(chalk.green(`\n  ✓ API URL updated to: ${newUrl}\n`));
}

async function resetConfig(): Promise<void> {
  console.log(chalk.yellow('  ⚠️  This will clear ALL configuration:\n'));
  console.log(chalk.gray('    • API key'));
  console.log(chalk.gray('    • Service keys'));
  console.log(chalk.gray('    • All settings\n'));

  const confirm = await prompt(chalk.red('  Type "RESET" to confirm: '));

  if (confirm !== 'RESET') {
    console.log(chalk.gray('\n  Cancelled.\n'));
    return;
  }

  clearApiKey();
  clearAllServiceKeys();

  console.log(chalk.green('\n  ✓ Configuration reset.\n'));
  console.log(chalk.gray('  Run `codebakers setup` to reconfigure.\n'));
}

function showHelp(): void {
  console.log(chalk.white('  Usage: codebakers config [action]\n'));
  console.log(chalk.white('  Actions:'));
  console.log(chalk.gray('    (none)      Show current configuration'));
  console.log(chalk.gray('    path        Show config file location'));
  console.log(chalk.gray('    keys        Show configured service keys'));
  console.log(chalk.gray('    clear-keys  Clear all service keys'));
  console.log(chalk.gray('    set-url     Change API URL (advanced)'));
  console.log(chalk.gray('    reset       Reset all configuration'));
  console.log('');
}
