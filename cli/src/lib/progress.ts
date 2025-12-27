import chalk from 'chalk';
import ora, { Ora } from 'ora';

/**
 * Multi-step progress tracker for CLI operations
 */
export interface Step {
  name: string;
  action: () => Promise<void>;
}

export class ProgressTracker {
  private currentStep = 0;
  private totalSteps: number;
  private steps: Step[];
  private spinner: Ora | null = null;

  constructor(steps: Step[]) {
    this.steps = steps;
    this.totalSteps = steps.length;
  }

  async run(): Promise<void> {
    for (let i = 0; i < this.steps.length; i++) {
      this.currentStep = i + 1;
      const step = this.steps[i];

      this.spinner = ora({
        text: this.formatStepText(step.name),
        prefixText: this.formatPrefix(),
      }).start();

      try {
        await step.action();
        this.spinner.succeed(this.formatStepText(step.name));
      } catch (error) {
        this.spinner.fail(this.formatStepText(step.name));
        throw error;
      }
    }
  }

  private formatPrefix(): string {
    return chalk.gray(`  [${this.currentStep}/${this.totalSteps}]`);
  }

  private formatStepText(text: string): string {
    return text;
  }
}

/**
 * Show a success box after completing a command
 */
export function showSuccessBox(title: string, lines: string[]): void {
  const maxLength = Math.max(title.length, ...lines.map(l => l.length)) + 4;
  const border = '═'.repeat(maxLength);

  console.log(chalk.green(`\n  ╔${border}╗`));
  console.log(chalk.green(`  ║`) + chalk.bold.white(` ${title.padEnd(maxLength - 2)} `) + chalk.green(`║`));
  console.log(chalk.green(`  ╠${border}╣`));

  for (const line of lines) {
    console.log(chalk.green(`  ║`) + chalk.white(` ${line.padEnd(maxLength - 2)} `) + chalk.green(`║`));
  }

  console.log(chalk.green(`  ╚${border}╝\n`));
}

/**
 * Display a quick start guide with examples
 */
export function showQuickStartGuide(): void {
  console.log(chalk.blue('\n  ═══════════════════════════════════════════════════════════'));
  console.log(chalk.bold.white('\n  📚 Quick Start Guide\n'));
  console.log(chalk.blue('  ═══════════════════════════════════════════════════════════\n'));

  console.log(chalk.white('  Just ask the AI in natural language:\n'));

  const examples = [
    {
      prompt: '"Build me a user dashboard with stats cards"',
      desc: 'AI will use CodeBakers patterns for layout, components, and data fetching',
    },
    {
      prompt: '"Add Stripe subscription to my app"',
      desc: 'AI loads payment patterns: checkout, webhooks, customer portal',
    },
    {
      prompt: '"Create an API endpoint for user profiles"',
      desc: 'AI generates: route handler, validation, error handling, types',
    },
    {
      prompt: '"Set up auth with Google and email login"',
      desc: 'AI implements OAuth + email auth following security patterns',
    },
  ];

  for (const example of examples) {
    console.log(chalk.cyan(`  → ${example.prompt}`));
    console.log(chalk.gray(`    ${example.desc}\n`));
  }

  console.log(chalk.blue('  ───────────────────────────────────────────────────────────\n'));

  console.log(chalk.white('  Pro Tips:\n'));
  console.log(chalk.gray('  • Ask the AI ') + chalk.cyan('"What patterns do you have for payments?"'));
  console.log(chalk.gray('  • Say ') + chalk.cyan('"/build a SaaS app"') + chalk.gray(' to start a full project'));
  console.log(chalk.gray('  • Try ') + chalk.cyan('"/audit"') + chalk.gray(' to check code quality'));
  console.log(chalk.gray('  • Use ') + chalk.cyan('"codebakers doctor"') + chalk.gray(' if something seems wrong\n'));

  console.log(chalk.blue('  ═══════════════════════════════════════════════════════════\n'));
}

/**
 * Format user-friendly error with context and recovery steps
 */
export interface FriendlyError {
  title: string;
  message: string;
  cause?: string;
  recovery: string[];
  helpUrl?: string;
}

export function formatFriendlyError(error: FriendlyError): string {
  let output = '';

  output += chalk.red(`\n  ❌ ${error.title}\n`);
  output += chalk.white(`\n  ${error.message}\n`);

  if (error.cause) {
    output += chalk.gray(`\n  Why: ${error.cause}\n`);
  }

  if (error.recovery.length > 0) {
    output += chalk.yellow(`\n  How to fix:\n`);
    for (let i = 0; i < error.recovery.length; i++) {
      output += chalk.white(`    ${i + 1}. ${error.recovery[i]}\n`);
    }
  }

  if (error.helpUrl) {
    output += chalk.gray(`\n  More help: ${error.helpUrl}\n`);
  }

  return output;
}

/**
 * Common error handlers with friendly messages
 */
export function getNetworkError(): FriendlyError {
  return {
    title: 'Connection Failed',
    message: 'Could not connect to CodeBakers servers.',
    cause: 'This usually means a network issue or the server is temporarily unavailable.',
    recovery: [
      'Check your internet connection',
      'Try again in a few seconds',
      'If using a VPN, try disabling it temporarily',
      'Check status.codebakers.ai for server status',
    ],
    helpUrl: 'https://codebakers.ai/docs/troubleshooting',
  };
}

export function getAuthError(): FriendlyError {
  return {
    title: 'Authentication Failed',
    message: 'Your API key is invalid or expired.',
    recovery: [
      'Go to codebakers.ai/dashboard',
      'Copy your API key (starts with cb_)',
      'Run: codebakers setup',
    ],
    helpUrl: 'https://codebakers.ai/docs/getting-started',
  };
}

export function getSubscriptionError(): FriendlyError {
  return {
    title: 'Subscription Required',
    message: 'This feature requires an active subscription.',
    recovery: [
      'Visit codebakers.ai/pricing to see plans',
      'Start a free trial with: codebakers setup',
      'Contact support if you believe this is an error',
    ],
    helpUrl: 'https://codebakers.ai/pricing',
  };
}
