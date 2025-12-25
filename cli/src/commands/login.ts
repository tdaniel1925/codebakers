import chalk from 'chalk';
import ora from 'ora';
import { createInterface } from 'readline';
import { setApiKey } from '../config.js';
import { validateApiKey, formatApiError, type ApiError } from '../lib/api.js';

async function prompt(question: string): Promise<string> {
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

export async function login(): Promise<void> {
  console.log(chalk.blue('\n  CodeBakers Login\n'));
  console.log(chalk.gray('  Get your API key at https://codebakers.ai/dashboard\n'));

  const apiKey = await prompt('  Enter your API key: ');

  if (!apiKey) {
    console.log(chalk.red('\n  API key is required.\n'));
    process.exit(1);
  }

  const spinner = ora('Validating API key...').start();

  try {
    await validateApiKey(apiKey);

    setApiKey(apiKey);
    spinner.succeed('Logged in successfully!');
    console.log(chalk.green('\n  You can now run `codebakers install` in your project.\n'));
  } catch (error) {
    spinner.fail('Login failed');

    if (error && typeof error === 'object' && 'recoverySteps' in error) {
      console.log(chalk.red(`\n  ${formatApiError(error as ApiError)}\n`));
    } else {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.log(chalk.red(`\n  Error: ${message}\n`));
    }

    process.exit(1);
  }
}
