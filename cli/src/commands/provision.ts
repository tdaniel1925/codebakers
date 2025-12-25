import chalk from 'chalk';
import ora from 'ora';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { createInterface } from 'readline';
import { getServiceKey, setServiceKey, SERVICE_KEY_LABELS, type ServiceName } from '../config.js';

/**
 * Supabase regions - allow user to select closest region
 */
const SUPABASE_REGIONS = [
  { id: 'us-east-1', name: 'US East (N. Virginia)', flag: '🇺🇸' },
  { id: 'us-west-1', name: 'US West (N. California)', flag: '🇺🇸' },
  { id: 'eu-west-1', name: 'EU West (Ireland)', flag: '🇮🇪' },
  { id: 'eu-west-2', name: 'EU West (London)', flag: '🇬🇧' },
  { id: 'eu-central-1', name: 'EU Central (Frankfurt)', flag: '🇩🇪' },
  { id: 'ap-southeast-1', name: 'Asia Pacific (Singapore)', flag: '🇸🇬' },
  { id: 'ap-southeast-2', name: 'Asia Pacific (Sydney)', flag: '🇦🇺' },
  { id: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)', flag: '🇯🇵' },
  { id: 'sa-east-1', name: 'South America (São Paulo)', flag: '🇧🇷' },
] as const;

type SupabaseRegion = typeof SUPABASE_REGIONS[number]['id'];

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
    dbPassword: string;
  };
  vercel?: {
    projectId: string;
    projectUrl: string;
    envVarsSet: boolean;
  };
}

/**
 * Retry a function with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    retries?: number;
    delay?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const { retries = 3, delay = 1000, onRetry } = options;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }

      const err = error instanceof Error ? error : new Error(String(error));

      // Don't retry on authentication errors
      if (err.message.includes('401') || err.message.includes('403') || err.message.includes('Invalid')) {
        throw error;
      }

      onRetry?.(attempt, err);
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }

  throw new Error('Max retries exceeded');
}

/**
 * Generate a cryptographically secure password
 */
function generateSecurePassword(): string {
  // Generate 24 random bytes and convert to base64url (URL-safe, no special chars)
  const bytes = crypto.randomBytes(24);
  const password = bytes.toString('base64url');

  // Ensure it meets typical password requirements (add special char and number)
  return `${password}!1`;
}

/**
 * Check if a service key is configured, prompt if not
 */
async function ensureServiceKey(service: ServiceName, instructions: string): Promise<string | null> {
  let key = getServiceKey(service);

  if (!key) {
    console.log(chalk.yellow(`\n  No ${SERVICE_KEY_LABELS[service]} API key configured.\n`));
    console.log(chalk.gray(instructions));

    const inputKey = await prompt(`\n  ${SERVICE_KEY_LABELS[service]} API key (or press Enter to skip): `);

    if (inputKey) {
      setServiceKey(service, inputKey);
      key = inputKey;
      console.log(chalk.green(`  ✓ ${SERVICE_KEY_LABELS[service]} key saved\n`));
    } else {
      console.log(chalk.gray(`  Skipping ${SERVICE_KEY_LABELS[service]} provisioning.\n`));
      return null;
    }
  }

  return key;
}

/**
 * Prompt for Supabase region selection
 */
async function selectSupabaseRegion(): Promise<SupabaseRegion> {
  console.log(chalk.white('\n  Select Supabase region (for lowest latency, pick closest to your users):\n'));

  SUPABASE_REGIONS.forEach((region, index) => {
    const isDefault = region.id === 'us-east-1';
    console.log(
      chalk.gray(`    ${index + 1}. `) +
      chalk.cyan(`${region.flag} ${region.name}`) +
      (isDefault ? chalk.green(' (default)') : '')
    );
  });

  console.log('');

  const input = await prompt(`  Enter 1-${SUPABASE_REGIONS.length} (or press Enter for default): `);

  if (!input) {
    return 'us-east-1';
  }

  const index = parseInt(input, 10) - 1;
  if (index >= 0 && index < SUPABASE_REGIONS.length) {
    const selected = SUPABASE_REGIONS[index];
    console.log(chalk.green(`  ✓ Selected: ${selected.flag} ${selected.name}\n`));
    return selected.id;
  }

  console.log(chalk.yellow('  Invalid selection, using default (US East).\n'));
  return 'us-east-1';
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
    console.log(chalk.yellow('  GitHub CLI (gh) not found.\n'));
    console.log(chalk.gray('  Install from: https://cli.github.com'));
    console.log(chalk.gray('  Or skip GitHub and create manually later.\n'));
    return null;
  }

  // Check if authenticated
  try {
    execSync('gh auth status', { stdio: 'pipe' });
  } catch {
    console.log(chalk.yellow('  Not logged into GitHub CLI.\n'));
    console.log(chalk.gray('  Run: gh auth login'));
    console.log(chalk.gray('  Then try again.\n'));
    return null;
  }

  const spinner = ora('Creating GitHub repository...').start();

  try {
    // Escape description for shell
    const safeDescription = description.replace(/"/g, '\\"');

    // Create the repo
    execSync(
      `gh repo create ${projectName} --public --description "${safeDescription}" --source . --remote origin --push`,
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
      console.log(chalk.gray('  Tip: You can link an existing repo with: gh repo view\n'));
    } else {
      console.log(chalk.red(`  Error: ${message}`));
      console.log(chalk.gray('  You can create the repository manually on GitHub.\n'));
    }
    return null;
  }
}

/**
 * Create a Supabase project
 */
export async function createSupabaseProject(
  projectName: string,
  options?: {
    organizationId?: string;
    region?: SupabaseRegion;
  }
): Promise<{ projectId: string; projectUrl: string; apiUrl: string; anonKey: string; dbPassword: string } | null> {
  const accessToken = await ensureServiceKey('supabase',
    '  Get your access token from: https://supabase.com/dashboard/account/tokens'
  );

  if (!accessToken) return null;

  // Select region if not provided
  const region = options?.region || await selectSupabaseRegion();

  const spinner = ora('Creating Supabase project...').start();

  try {
    let organizationId = options?.organizationId;

    // Get organization if not provided
    if (!organizationId) {
      spinner.text = 'Fetching organizations...';

      const orgsResponse = await withRetry(
        () => fetch('https://api.supabase.com/v1/organizations', {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }).then(r => {
          if (!r.ok) throw new Error(`Failed to fetch organizations (${r.status})`);
          return r.json();
        }),
        {
          onRetry: (attempt) => {
            spinner.text = `Fetching organizations (retry ${attempt})...`;
          },
        }
      );

      if (!orgsResponse || orgsResponse.length === 0) {
        throw new Error('No organizations found. Create one at supabase.com/dashboard first.');
      }

      organizationId = orgsResponse[0].id;
    }

    spinner.text = 'Creating Supabase project...';

    // Generate a cryptographically secure password
    const dbPassword = generateSecurePassword();

    // Create the project
    const project = await withRetry(
      () => fetch('https://api.supabase.com/v1/projects', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: projectName,
          organization_id: organizationId,
          region: region,
          plan: 'free',
          db_pass: dbPassword,
        }),
      }).then(async r => {
        if (!r.ok) {
          const error = await r.json().catch(() => ({}));
          throw new Error(error.message || `Failed to create project (${r.status})`);
        }
        return r.json();
      }),
      {
        onRetry: (attempt) => {
          spinner.text = `Creating Supabase project (retry ${attempt})...`;
        },
      }
    );

    spinner.succeed('Supabase project created!');

    // Wait for project to be ready
    const waitSpinner = ora('Waiting for project to be ready...').start();

    let projectReady = false;
    let attempts = 0;
    let projectDetails: { api_url?: string; anon_key?: string } = {};

    while (!projectReady && attempts < 60) { // Up to 2 minutes
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        const statusResponse = await fetch(`https://api.supabase.com/v1/projects/${project.id}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        if (statusResponse.ok) {
          projectDetails = await statusResponse.json();
          if (projectDetails.api_url) {
            projectReady = true;
          }
        }
      } catch {
        // Ignore errors during polling
      }

      attempts++;
      waitSpinner.text = `Waiting for project to be ready... (${attempts * 2}s)`;
    }

    if (!projectReady) {
      waitSpinner.warn('Project created but may need a few more minutes to be fully ready.');
      console.log(chalk.gray('  You can check status at the project URL.\n'));
    } else {
      waitSpinner.succeed('Project ready!');
    }

    const projectUrl = `https://supabase.com/dashboard/project/${project.id}`;
    console.log(chalk.gray(`  ${projectUrl}\n`));

    // Get the anon key
    let anonKey = '';
    try {
      const keysResponse = await fetch(`https://api.supabase.com/v1/projects/${project.id}/api-keys`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (keysResponse.ok) {
        const keys = await keysResponse.json();
        const anonKeyObj = keys.find((k: { name: string }) => k.name === 'anon');
        anonKey = anonKeyObj?.api_key || '';
      }
    } catch {
      console.log(chalk.yellow('  Note: Could not fetch anon key automatically.'));
      console.log(chalk.gray('  Get it from: Settings → API in your Supabase dashboard.\n'));
    }

    return {
      projectId: project.id,
      projectUrl,
      apiUrl: projectDetails.api_url || `https://${project.id}.supabase.co`,
      anonKey,
      dbPassword,
    };
  } catch (error) {
    spinner.fail('Failed to create Supabase project');
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('limit')) {
      console.log(chalk.red(`  Error: ${message}`));
      console.log(chalk.gray('  Free tier allows 2 projects. Delete old ones or upgrade.\n'));
    } else {
      console.log(chalk.red(`  Error: ${message}`));
      console.log(chalk.gray('  Check your access token and try again.\n'));
    }

    return null;
  }
}

/**
 * Create a Vercel project with environment variables
 */
export async function createVercelProject(
  projectName: string,
  options?: {
    gitRepoUrl?: string;
    envVars?: Record<string, string>;
  }
): Promise<{ projectId: string; projectUrl: string; envVarsSet: boolean } | null> {
  const accessToken = await ensureServiceKey('vercel',
    '  Get your token from: https://vercel.com/account/tokens'
  );

  if (!accessToken) return null;

  const spinner = ora('Creating Vercel project...').start();

  try {
    // Create the project
    const projectBody: Record<string, unknown> = {
      name: projectName,
      framework: 'nextjs',
    };

    // Link to GitHub repo if provided
    if (options?.gitRepoUrl) {
      projectBody.gitRepository = {
        type: 'github',
        repo: options.gitRepoUrl.replace('https://github.com/', ''),
      };
    }

    const project = await withRetry(
      () => fetch('https://api.vercel.com/v10/projects', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(projectBody),
      }).then(async r => {
        if (!r.ok) {
          const error = await r.json().catch(() => ({}));
          throw new Error(error.error?.message || `Failed to create project (${r.status})`);
        }
        return r.json();
      }),
      {
        onRetry: (attempt) => {
          spinner.text = `Creating Vercel project (retry ${attempt})...`;
        },
      }
    );

    spinner.succeed('Vercel project created!');

    const projectUrl = `https://vercel.com/${project.accountId}/${project.name}`;
    console.log(chalk.gray(`  ${projectUrl}\n`));

    // Set environment variables if provided
    let envVarsSet = false;
    if (options?.envVars && Object.keys(options.envVars).length > 0) {
      const envSpinner = ora('Setting environment variables...').start();

      try {
        // Vercel expects env vars in a specific format
        const envVarPromises = Object.entries(options.envVars).map(([key, value]) =>
          fetch(`https://api.vercel.com/v10/projects/${project.id}/env`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              key,
              value,
              type: key.startsWith('NEXT_PUBLIC_') ? 'plain' : 'encrypted',
              target: ['production', 'preview', 'development'],
            }),
          }).then(r => {
            if (!r.ok) {
              console.log(chalk.yellow(`  Warning: Could not set ${key}`));
            }
            return r.ok;
          })
        );

        const results = await Promise.all(envVarPromises);
        const successCount = results.filter(Boolean).length;

        if (successCount === Object.keys(options.envVars).length) {
          envSpinner.succeed(`Set ${successCount} environment variables!`);
          envVarsSet = true;
        } else {
          envSpinner.warn(`Set ${successCount}/${Object.keys(options.envVars).length} environment variables`);
        }
      } catch (error) {
        envSpinner.warn('Could not set some environment variables');
        console.log(chalk.gray('  Set them manually in the Vercel dashboard.\n'));
      }
    }

    return {
      projectId: project.id,
      projectUrl,
      envVarsSet,
    };
  } catch (error) {
    spinner.fail('Failed to create Vercel project');
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('already exists')) {
      console.log(chalk.yellow('  Project already exists. Skipping.\n'));
      console.log(chalk.gray('  You can link to existing project in Vercel dashboard.\n'));
    } else {
      console.log(chalk.red(`  Error: ${message}`));
      console.log(chalk.gray('  Check your token and try again.\n'));
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

  // 3. Vercel (with environment variables from Supabase)
  console.log(chalk.white('  Step 3: Vercel Project\n'));

  // Prepare env vars for Vercel
  const vercelEnvVars: Record<string, string> = {};

  if (result.supabase) {
    vercelEnvVars['NEXT_PUBLIC_SUPABASE_URL'] = result.supabase.apiUrl;
    if (result.supabase.anonKey) {
      vercelEnvVars['NEXT_PUBLIC_SUPABASE_ANON_KEY'] = result.supabase.anonKey;
    }
  }

  const vercel = await createVercelProject(projectName, {
    gitRepoUrl: result.github?.repoUrl,
    envVars: Object.keys(vercelEnvVars).length > 0 ? vercelEnvVars : undefined,
  });

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
    const envStatus = result.vercel.envVarsSet ? ' (env vars set!)' : '';
    console.log(chalk.green('  ✅ Vercel: ') + chalk.gray(result.vercel.projectUrl) + chalk.green(envStatus));
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
