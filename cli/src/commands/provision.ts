import chalk from 'chalk';
import ora from 'ora';
import { execSync, exec } from 'child_process';
import { createInterface } from 'readline';
import { getServiceKey, setServiceKey, type ServiceName } from '../config.js';

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

export interface ProvisionResult {
  github?: {
    repoUrl: string;
    cloneUrl: string;
  };
  supabase?: {
    projectId: string;
    projectUrl: string;
    apiUrl: string;
    anonKey: string;
  };
  vercel?: {
    projectId: string;
    projectUrl: string;
  };
}

/**
 * Check if a service key is configured, prompt if not
 */
async function ensureServiceKey(service: ServiceName, instructions: string): Promise<string | null> {
  let key = getServiceKey(service);

  if (!key) {
    console.log(chalk.yellow(`\n  No ${service} API key configured.\n`));
    console.log(chalk.gray(instructions));

    const inputKey = await prompt(`\n  ${service} API key (or press Enter to skip): `);

    if (inputKey) {
      setServiceKey(service, inputKey);
      key = inputKey;
      console.log(chalk.green(`  ✓ ${service} key saved\n`));
    } else {
      console.log(chalk.gray(`  Skipping ${service} provisioning.\n`));
      return null;
    }
  }

  return key;
}

/**
 * Create a GitHub repository
 */
export async function createGitHubRepo(
  projectName: string,
  description: string = ''
): Promise<{ repoUrl: string; cloneUrl: string } | null> {
  // Check if gh CLI is available
  try {
    execSync('gh --version', { stdio: 'pipe' });
  } catch {
    console.log(chalk.yellow('  GitHub CLI (gh) not found. Install it from: https://cli.github.com\n'));
    return null;
  }

  // Check if authenticated
  try {
    execSync('gh auth status', { stdio: 'pipe' });
  } catch {
    console.log(chalk.yellow('  Not logged into GitHub CLI.\n'));
    console.log(chalk.gray('  Run: gh auth login\n'));
    return null;
  }

  const spinner = ora('Creating GitHub repository...').start();

  try {
    // Create the repo
    const result = execSync(
      `gh repo create ${projectName} --public --description "${description}" --source . --remote origin --push`,
      { encoding: 'utf-8', stdio: 'pipe' }
    );

    // Get the repo URL
    const repoUrl = execSync('gh repo view --json url -q .url', { encoding: 'utf-8' }).trim();
    const cloneUrl = `${repoUrl}.git`;

    spinner.succeed('GitHub repository created!');
    console.log(chalk.gray(`  ${repoUrl}\n`));

    return { repoUrl, cloneUrl };
  } catch (error) {
    spinner.fail('Failed to create GitHub repository');
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('already exists')) {
      console.log(chalk.yellow('  Repository already exists. Skipping.\n'));
    } else {
      console.log(chalk.red(`  Error: ${message}\n`));
    }
    return null;
  }
}

/**
 * Create a Supabase project
 */
export async function createSupabaseProject(
  projectName: string,
  organizationId?: string
): Promise<{ projectId: string; projectUrl: string; apiUrl: string; anonKey: string } | null> {
  const accessToken = await ensureServiceKey('supabase',
    '  Get your access token from: https://supabase.com/dashboard/account/tokens'
  );

  if (!accessToken) return null;

  const spinner = ora('Creating Supabase project...').start();

  try {
    // Get organization if not provided
    if (!organizationId) {
      const orgsResponse = await fetch('https://api.supabase.com/v1/organizations', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!orgsResponse.ok) {
        throw new Error('Failed to fetch organizations. Check your access token.');
      }

      const orgs = await orgsResponse.json();
      if (orgs.length === 0) {
        throw new Error('No organizations found. Create one at supabase.com first.');
      }

      organizationId = orgs[0].id;
    }

    // Generate a random password for the database
    const dbPassword = Math.random().toString(36).slice(-16) +
                       Math.random().toString(36).slice(-16).toUpperCase() +
                       '!1';

    // Create the project
    const createResponse = await fetch('https://api.supabase.com/v1/projects', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectName,
        organization_id: organizationId,
        region: 'us-east-1',
        plan: 'free',
        db_pass: dbPassword,
      }),
    });

    if (!createResponse.ok) {
      const error = await createResponse.json();
      throw new Error(error.message || 'Failed to create project');
    }

    const project = await createResponse.json();

    spinner.succeed('Supabase project created!');

    // Wait for project to be ready (it takes a moment)
    const waitSpinner = ora('Waiting for project to be ready...').start();

    let projectReady = false;
    let attempts = 0;
    let projectDetails: { api_url?: string; anon_key?: string } = {};

    while (!projectReady && attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const statusResponse = await fetch(`https://api.supabase.com/v1/projects/${project.id}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (statusResponse.ok) {
        projectDetails = await statusResponse.json();
        if (projectDetails.api_url) {
          projectReady = true;
        }
      }
      attempts++;
    }

    if (!projectReady) {
      waitSpinner.warn('Project created but may not be fully ready yet.');
    } else {
      waitSpinner.succeed('Project ready!');
    }

    const projectUrl = `https://supabase.com/dashboard/project/${project.id}`;
    console.log(chalk.gray(`  ${projectUrl}\n`));

    // Get the anon key
    const keysResponse = await fetch(`https://api.supabase.com/v1/projects/${project.id}/api-keys`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    let anonKey = '';
    if (keysResponse.ok) {
      const keys = await keysResponse.json();
      const anonKeyObj = keys.find((k: { name: string }) => k.name === 'anon');
      anonKey = anonKeyObj?.api_key || '';
    }

    return {
      projectId: project.id,
      projectUrl,
      apiUrl: projectDetails.api_url || `https://${project.id}.supabase.co`,
      anonKey,
    };
  } catch (error) {
    spinner.fail('Failed to create Supabase project');
    const message = error instanceof Error ? error.message : String(error);
    console.log(chalk.red(`  Error: ${message}\n`));
    return null;
  }
}

/**
 * Create a Vercel project
 */
export async function createVercelProject(
  projectName: string,
  gitRepoUrl?: string
): Promise<{ projectId: string; projectUrl: string } | null> {
  const accessToken = await ensureServiceKey('vercel',
    '  Get your token from: https://vercel.com/account/tokens'
  );

  if (!accessToken) return null;

  const spinner = ora('Creating Vercel project...').start();

  try {
    // Create the project
    const createResponse = await fetch('https://api.vercel.com/v10/projects', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectName,
        framework: 'nextjs',
        ...(gitRepoUrl && {
          gitRepository: {
            type: 'github',
            repo: gitRepoUrl.replace('https://github.com/', ''),
          },
        }),
      }),
    });

    if (!createResponse.ok) {
      const error = await createResponse.json();
      throw new Error(error.error?.message || 'Failed to create project');
    }

    const project = await createResponse.json();

    spinner.succeed('Vercel project created!');

    const projectUrl = `https://vercel.com/${project.accountId}/${project.name}`;
    console.log(chalk.gray(`  ${projectUrl}\n`));

    return {
      projectId: project.id,
      projectUrl,
    };
  } catch (error) {
    spinner.fail('Failed to create Vercel project');
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('already exists')) {
      console.log(chalk.yellow('  Project already exists. Skipping.\n'));
    } else {
      console.log(chalk.red(`  Error: ${message}\n`));
    }
    return null;
  }
}

/**
 * Full provisioning flow - create all services
 */
export async function provisionAll(
  projectName: string,
  description: string = ''
): Promise<ProvisionResult> {
  console.log(chalk.blue('\n  ══════════════════════════════════════════════════════════'));
  console.log(chalk.white.bold('  🚀 Auto-Provisioning Services\n'));
  console.log(chalk.blue('  ══════════════════════════════════════════════════════════\n'));

  const result: ProvisionResult = {};

  // 1. GitHub
  console.log(chalk.white('  Step 1: GitHub Repository\n'));
  const github = await createGitHubRepo(projectName, description);
  if (github) {
    result.github = github;
  }

  // 2. Supabase
  console.log(chalk.white('  Step 2: Supabase Project\n'));
  const supabase = await createSupabaseProject(projectName);
  if (supabase) {
    result.supabase = supabase;
  }

  // 3. Vercel
  console.log(chalk.white('  Step 3: Vercel Project\n'));
  const vercel = await createVercelProject(projectName, result.github?.repoUrl);
  if (vercel) {
    result.vercel = vercel;
  }

  // Summary
  console.log(chalk.blue('  ══════════════════════════════════════════════════════════'));
  console.log(chalk.white.bold('  📋 Provisioning Summary\n'));
  console.log(chalk.blue('  ══════════════════════════════════════════════════════════\n'));

  if (result.github) {
    console.log(chalk.green('  ✅ GitHub: ') + chalk.gray(result.github.repoUrl));
  } else {
    console.log(chalk.yellow('  ⏭️  GitHub: Skipped'));
  }

  if (result.supabase) {
    console.log(chalk.green('  ✅ Supabase: ') + chalk.gray(result.supabase.projectUrl));
  } else {
    console.log(chalk.yellow('  ⏭️  Supabase: Skipped'));
  }

  if (result.vercel) {
    console.log(chalk.green('  ✅ Vercel: ') + chalk.gray(result.vercel.projectUrl));
  } else {
    console.log(chalk.yellow('  ⏭️  Vercel: Skipped'));
  }

  console.log('');

  return result;
}

/**
 * Check which services have keys configured
 */
export function getConfiguredServices(): { github: boolean; supabase: boolean; vercel: boolean } {
  return {
    github: false, // GitHub uses gh CLI auth, not stored key
    supabase: !!getServiceKey('supabase'),
    vercel: !!getServiceKey('vercel'),
  };
}
