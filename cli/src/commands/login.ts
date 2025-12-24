import chalk from 'chalk';
import ora from 'ora';
import { createInterface } from 'readline';
import { setApiKey, getApiUrl } from '../config.js';

async function prompt(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

export async function login(): Promise<void> {
  console.log(chalk.blue('\n  CodeBakers Login\n'));
  console.log(chalk.gray('  Get your API key at https://codebakers.ai/dashboard\n'));

  const apiKey = await prompt('  Enter your API key: ');

  if (!apiKey || !apiKey.startsWith('cb_')) {
    console.log(chalk.red('\n  Invalid API key format. Keys start with "cb_"\n'));
    process.exit(1);
  }

  const spinner = ora('Validating API key...').start();

  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/content`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Invalid API key');
    }

    setApiKey(apiKey);
    spinner.succeed('Logged in successfully!');
    console.log(chalk.green('\n  You can now run `codebakers install` in your project.\n'));
  } catch (error) {
    spinner.fail('Login failed');
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`\n  Error: ${message}\n`));
    process.exit(1);
  }
}
