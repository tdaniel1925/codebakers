import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import { createInterface } from 'readline';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { getApiKey, getApiUrl, getTrialState, hasValidAccess } from '../config.js';

/**
 * CODEBAKERS BUILD COMMAND
 *
 * This is the zero-friction project builder.
 * User describes what they want → AI builds actual files on their machine.
 *
 * Flow:
 * 1. User runs: codebakers build "SaaS for invoicing"
 * 2. CLI creates engineering session on server
 * 3. Server runs AI agents to generate PRD, specs, code
 * 4. CLI receives file contents and writes them to disk
 * 5. User has a runnable project
 */

interface BuildOptions {
  description?: string;
  output?: string;
  verbose?: boolean;
}

interface FileToCreate {
  path: string;
  content: string;
  type: 'code' | 'config' | 'doc';
}

interface BuildPhase {
  phase: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  displayName: string;
  files?: FileToCreate[];
}

interface BuildStreamEvent {
  type: 'phase_start' | 'phase_complete' | 'file_create' | 'message' | 'error' | 'complete';
  phase?: string;
  displayName?: string;
  message?: string;
  file?: FileToCreate;
  files?: FileToCreate[];
  error?: string;
  summary?: {
    filesCreated: number;
    phases: number;
    tokensUsed: number;
  };
}

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

/**
 * Main build command
 */
export async function build(options: BuildOptions = {}): Promise<void> {
  console.log(chalk.blue(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   ${chalk.bold('CodeBakers Build')}                                      ║
  ║                                                           ║
  ║   Describe your project → Get working code                ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
  `));

  // Check authentication
  if (!hasValidAccess()) {
    console.log(chalk.red('  ✗ Not authenticated\n'));
    console.log(chalk.gray('  Run: codebakers go (free trial) or codebakers setup (with API key)\n'));
    process.exit(1);
  }

  // Get project description
  let description = options.description;
  if (!description) {
    console.log(chalk.white('  What do you want to build?\n'));
    console.log(chalk.gray('  Examples:'));
    console.log(chalk.gray('    • "A SaaS for managing invoices with Stripe payments"'));
    console.log(chalk.gray('    • "Todo app with user auth and real-time sync"'));
    console.log(chalk.gray('    • "Blog platform with markdown support"\n'));

    description = await prompt('  Describe your project: ');

    if (!description.trim()) {
      console.log(chalk.red('\n  Please provide a project description.\n'));
      process.exit(1);
    }
  }

  const outputDir = options.output || process.cwd();

  // Check if directory is empty
  const files = existsSync(outputDir) ?
    require('fs').readdirSync(outputDir).filter((f: string) => !f.startsWith('.')) : [];

  if (files.length > 0) {
    console.log(chalk.yellow('\n  ⚠️  This directory is not empty.'));
    const proceed = await prompt('  Continue? (y/N): ');
    if (proceed.toLowerCase() !== 'y') {
      console.log(chalk.gray('\n  Build cancelled.\n'));
      return;
    }
  }

  console.log(chalk.green(`\n  Building: "${description}"\n`));

  // Create engineering session
  const spinner = ora('  Initializing build...').start();

  try {
    const apiUrl = getApiUrl();
    const apiKey = getApiKey();
    const trial = getTrialState();

    let authHeader = '';
    if (apiKey) {
      authHeader = `Bearer ${apiKey}`;
    } else if (trial?.trialId) {
      authHeader = `Trial ${trial.trialId}`;
    }

    if (!authHeader) {
      spinner.fail('Authentication required');
      console.log(chalk.gray('\n  Run: codebakers go\n'));
      return;
    }

    // Step 1: Create engineering session
    spinner.text = '  Creating build session...';

    const createResponse = await fetch(`${apiUrl}/api/engineering/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        projectName: description,
        projectDescription: description,
        source: 'cli',
      }),
    });

    if (!createResponse.ok) {
      const error = await createResponse.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to create build session');
    }

    const { data: sessionData } = await createResponse.json();
    const sessionId = sessionData.sessionId;

    spinner.text = '  Session created, starting build...';

    // Step 2: Auto-complete scoping
    await fetch(`${apiUrl}/api/engineering/sessions/${sessionId}/scope`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({ stepId: 'auto', answer: description }),
    });

    // Step 3: Start the build with file generation enabled
    const buildResponse = await fetch(`${apiUrl}/api/engineering/sessions/${sessionId}/build`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        generateFiles: true, // Tell server to generate actual file contents
      }),
    });

    if (!buildResponse.ok) {
      const error = await buildResponse.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to start build');
    }

    spinner.succeed('Build started!');
    console.log('');

    // Step 4: Stream progress and receive files
    await streamBuildProgress(apiUrl, authHeader, sessionId, outputDir, options.verbose);

  } catch (error) {
    spinner.fail('Build failed');
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`\n  Error: ${message}\n`));
    process.exit(1);
  }
}

/**
 * Stream build progress and write files as they're generated
 */
async function streamBuildProgress(
  apiUrl: string,
  authHeader: string,
  sessionId: string,
  outputDir: string,
  verbose?: boolean
): Promise<void> {
  const phases: Map<string, BuildPhase> = new Map();
  let filesCreated = 0;
  let currentSpinner: Ora | null = null;

  // Display phase progress
  function displayPhase(phase: string, status: string, displayName: string): void {
    const icon = status === 'completed' ? chalk.green('✓') :
                 status === 'in_progress' ? chalk.blue('●') :
                 status === 'failed' ? chalk.red('✗') : chalk.gray('○');

    if (status === 'in_progress') {
      if (currentSpinner) currentSpinner.stop();
      currentSpinner = ora(`  ${displayName}...`).start();
    } else if (status === 'completed' && currentSpinner) {
      currentSpinner.succeed(`  ${displayName}`);
      currentSpinner = null;
    } else if (status === 'failed' && currentSpinner) {
      currentSpinner.fail(`  ${displayName}`);
      currentSpinner = null;
    }
  }

  // Write a file to disk
  function writeFile(file: FileToCreate): void {
    const fullPath = join(outputDir, file.path);
    const dir = dirname(fullPath);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(fullPath, file.content);
    filesCreated++;

    if (verbose) {
      console.log(chalk.gray(`    + ${file.path}`));
    }
  }

  // Poll for updates (SSE would be better but this works for CLI)
  let isComplete = false;
  let pollCount = 0;
  const maxPolls = 300; // 10 minutes max (2s intervals)

  while (!isComplete && pollCount < maxPolls) {
    try {
      const response = await fetch(`${apiUrl}/api/engineering/sessions/${sessionId}/progress`, {
        headers: {
          'Authorization': authHeader,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get build progress');
      }

      const data = await response.json();
      const progress = data.data || data;

      // Update phase displays
      if (progress.phases) {
        for (const phase of progress.phases) {
          const existing = phases.get(phase.phase);
          if (!existing || existing.status !== phase.status) {
            phases.set(phase.phase, phase);
            displayPhase(phase.phase, phase.status, phase.displayName || phase.phase);
          }
        }
      }

      // Write any new files
      if (progress.newFiles && progress.newFiles.length > 0) {
        for (const file of progress.newFiles) {
          writeFile(file);
        }
      }

      // Check if build is complete
      if (progress.status === 'completed' || progress.status === 'failed' || progress.status === 'abandoned') {
        isComplete = true;

        if (currentSpinner !== null) {
          (currentSpinner as Ora).stop();
          currentSpinner = null;
        }

        if (progress.status === 'completed') {
          // Write final files if any
          if (progress.files && progress.files.length > 0) {
            console.log(chalk.white('\n  Writing project files...\n'));
            const fileSpinner = ora('  Creating files...').start();

            for (const file of progress.files) {
              writeFile(file);
            }

            fileSpinner.succeed(`  Created ${filesCreated} files`);
          }

          // Success message
          console.log(chalk.green(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   ${chalk.bold('✓ Build complete!')}                                     ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
          `));

          console.log(chalk.white('  Next steps:\n'));
          console.log(chalk.cyan('    1. ') + chalk.white('Install dependencies:'));
          console.log(chalk.gray('       npm install\n'));
          console.log(chalk.cyan('    2. ') + chalk.white('Set up your database:'));
          console.log(chalk.gray('       npx drizzle-kit db:push\n'));
          console.log(chalk.cyan('    3. ') + chalk.white('Start the dev server:'));
          console.log(chalk.gray('       npm run dev\n'));

          // Show summary
          if (progress.summary) {
            console.log(chalk.gray(`  Summary: ${progress.summary.filesCreated || filesCreated} files, ${progress.summary.tokensUsed || 0} tokens used\n`));
          }

        } else {
          console.log(chalk.red(`\n  Build ${progress.status}: ${progress.lastError || 'Unknown error'}\n`));
        }
      }

    } catch (error) {
      if (verbose) {
        console.log(chalk.gray(`    Poll error: ${error}`));
      }
    }

    if (!isComplete) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      pollCount++;
    }
  }

  if (!isComplete) {
    if (currentSpinner !== null) {
      (currentSpinner as Ora).fail('Build timed out');
    }
    console.log(chalk.yellow('\n  Build is taking longer than expected.'));
    console.log(chalk.gray('  Check status: codebakers build-status\n'));
  }
}

/**
 * Check build status
 */
export async function buildStatus(): Promise<void> {
  console.log(chalk.blue('\n  Checking recent builds...\n'));

  const apiUrl = getApiUrl();
  const apiKey = getApiKey();
  const trial = getTrialState();

  let authHeader = '';
  if (apiKey) {
    authHeader = `Bearer ${apiKey}`;
  } else if (trial?.trialId) {
    authHeader = `Trial ${trial.trialId}`;
  }

  if (!authHeader) {
    console.log(chalk.red('  Not authenticated. Run: codebakers go\n'));
    return;
  }

  try {
    const response = await fetch(`${apiUrl}/api/engineering/sessions`, {
      headers: {
        'Authorization': authHeader,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get builds');
    }

    const { data } = await response.json();
    const sessions = data.sessions || [];

    if (sessions.length === 0) {
      console.log(chalk.gray('  No builds found. Run: codebakers build "your project"\n'));
      return;
    }

    console.log(chalk.white('  Recent builds:\n'));
    for (const session of sessions.slice(0, 5)) {
      const statusIcon = session.status === 'completed' ? chalk.green('✓') :
                        session.status === 'active' ? chalk.blue('●') :
                        session.status === 'failed' ? chalk.red('✗') : chalk.gray('○');

      console.log(`  ${statusIcon} ${session.projectName}`);
      console.log(chalk.gray(`    Status: ${session.status} | Phase: ${session.currentPhase} | Progress: ${session.progress}%\n`));
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`  Error: ${message}\n`));
  }
}
