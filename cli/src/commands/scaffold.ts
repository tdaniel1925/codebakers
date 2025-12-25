import chalk from 'chalk';
import ora from 'ora';
import { createInterface } from 'readline';
import { writeFileSync, mkdirSync, existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import * as templates from '../templates/nextjs-supabase.js';
import { getApiKey, getApiUrl, setServiceKey, getServiceKey } from '../config.js';
import { provisionAll, type ProvisionResult } from './provision.js';

interface ServerServiceKeys {
  github: string | null;
  supabase: string | null;
  vercel: string | null;
}

/**
 * Fetch service keys from CodeBakers server
 */
async function fetchServerKeys(): Promise<ServerServiceKeys | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/cli/service-keys`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      return await response.json();
    }
  } catch {
    // Server unreachable or error
  }
  return null;
}

/**
 * Sync server keys to local storage
 */
function syncKeysToLocal(keys: ServerServiceKeys): void {
  if (keys.github) setServiceKey('github', keys.github);
  if (keys.supabase) setServiceKey('supabase', keys.supabase);
  if (keys.vercel) setServiceKey('vercel', keys.vercel);
}

// Cursor IDE configuration templates
const CURSORRULES_TEMPLATE = `# CODEBAKERS CURSOR RULES
# Zero-friction AI assistance - everything is automatic

## ON EVERY MESSAGE - AUTOMATIC WORKFLOW

### PHASE 1: CONTEXT LOAD (automatic)
1. Read CLAUDE.md → Load router
2. Read PRD.md → Understand what we're building
3. Read PROJECT-CONTEXT.md → Understand codebase
4. Read PROJECT-STATE.md → Check what's in progress
5. Read DECISIONS.md → Know past decisions

### PHASE 2: PRE-FLIGHT CHECK (before writing code)
Ask yourself silently:
- [ ] What existing code does this touch? (check PROJECT-CONTEXT.md)
- [ ] Is similar code already in the codebase? (copy that pattern)
- [ ] What's the data model involved?
- [ ] What are the error cases?
- [ ] Is someone else working on this? (check PROJECT-STATE.md)

### PHASE 3: EXECUTE
- State: \`📋 CodeBakers | [Type] | Modules: [list]\`
- Load required modules from .claude/
- Follow patterns EXACTLY

### PHASE 4: SELF-REVIEW (before saying "done")
- [ ] TypeScript compiles? (npx tsc --noEmit)
- [ ] Imports resolve correctly?
- [ ] Error handling exists?
- [ ] Matches existing patterns in codebase?
- [ ] Tests written?
- [ ] PROJECT-STATE.md updated?

If ANY check fails, fix it before responding.

## REMEMBER
- You are a full product team, not just a code assistant
- The modules contain production-tested patterns — USE THEM
- When in doubt, check existing code first
`;

const CURSORIGNORE_TEMPLATE = `# CodeBakers - Files to ignore in Cursor context

# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
build/
.next/
.nuxt/
out/

# Cache
.cache/
.turbo/
.eslintcache
*.tsbuildinfo

# Logs
logs/
*.log

# Environment files
.env
.env.local
.env.*.local

# IDE
.idea/
*.swp

# OS
.DS_Store
Thumbs.db

# Test coverage
coverage/

# Package locks
package-lock.json
yarn.lock
pnpm-lock.yaml

# Generated files
*.min.js
*.min.css
*.map
`;

function createPrdTemplate(projectName: string): string {
  const date = new Date().toISOString().split('T')[0];
  return `# Product Requirements Document
# Project: ${projectName}
# Created: ${date}

## Overview
**One-liner:** [Describe this project in one sentence]

**Problem:** [What problem does this solve?]

**Solution:** [How does this solve it?]

## Target Users
- **Primary:** [Who is the main user?]
- **Secondary:** [Other users?]

## Core Features (MVP)
<!-- List the MINIMUM features needed to launch -->

1. [ ] **Feature 1:** [Description]
   - Acceptance criteria: [How do we know it's done?]

2. [ ] **Feature 2:** [Description]
   - Acceptance criteria: [How do we know it's done?]

3. [ ] **Feature 3:** [Description]
   - Acceptance criteria: [How do we know it's done?]

## Nice-to-Have Features (Post-MVP)

1. [ ] [Feature description]
2. [ ] [Feature description]

## Technical Requirements

- **Must use:** [Required technologies, APIs, etc.]
- **Must avoid:** [Things you don't want]
- **Performance:** [Any speed/scale requirements?]
- **Security:** [Auth requirements, data sensitivity?]

## Success Metrics
- [ ] [How will you measure success?]
- [ ] [What does "done" look like?]

---
<!-- AI INSTRUCTIONS -->
<!-- When building features, reference this PRD -->
<!-- Check off features as they're completed -->
`;
}

function createProjectState(projectName: string): string {
  const date = new Date().toISOString().split('T')[0];
  return `# PROJECT STATE
# Last Updated: ${date}
# Auto-maintained by AI - update when starting/completing tasks

## Project Info
name: ${projectName}
phase: setup

## In Progress
<!-- AI: Add tasks here when you START working on them -->

## Completed
<!-- AI: Move tasks here when DONE -->

## Next Up
<!-- AI: Queue of upcoming tasks -->
`;
}

function createProjectContext(projectName: string): string {
  const date = new Date().toISOString().split('T')[0];
  return `# PROJECT CONTEXT
# Last Scanned: ${date}
# AI: Update this when you first analyze the project

## Overview
name: ${projectName}
description: [AI will fill after scanning]

## Tech Stack
framework: Next.js 14
language: TypeScript
database: Drizzle ORM + Supabase
auth: Supabase Auth
styling: Tailwind CSS

## Project Structure
\`\`\`
src/
├── app/           ← Pages & layouts
├── components/    ← React components
├── lib/           ← Utilities & clients
│   └── supabase/  ← Supabase clients
├── db/            ← Database schema & queries
├── services/      ← Business logic
└── types/         ← TypeScript types
\`\`\`

## Key Files
- Entry point: src/app/page.tsx
- Database schema: src/db/schema.ts
- API routes: src/app/api/

## Notes
<!-- AI: Any important context about this specific project -->
`;
}

function createDecisionsLog(projectName: string): string {
  const date = new Date().toISOString().split('T')[0];
  return `# ARCHITECTURAL DECISIONS
# Project: ${projectName}
# AI: Add entries here when making significant technical choices

## How to Use This File
When you make a decision that affects architecture, add an entry:
- Date
- Decision
- Reason
- Alternatives considered

---

## ${date}: Project Initialized
**Decision:** Using CodeBakers pattern system with Next.js + Supabase + Drizzle
**Reason:** Production-ready stack with type safety and excellent DX

---

<!-- AI: Add new decisions above this line -->
`;
}

interface ContentResponse {
  version: string;
  router: string;
  modules: Record<string, string>;
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

async function confirm(question: string): Promise<boolean> {
  const answer = await prompt(`${question} (Y/n): `);
  return answer.toLowerCase() !== 'n';
}

/**
 * Scaffold a new project with full structure
 */
export async function scaffold(): Promise<void> {
  console.log(chalk.blue(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   ${chalk.bold('CodeBakers Project Scaffolding')}                        ║
  ║                                                           ║
  ║   Create a production-ready project in seconds            ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
  `));

  const cwd = process.cwd();
  const files = readdirSync(cwd);
  const hasFiles = files.filter(f => !f.startsWith('.')).length > 0;

  if (hasFiles) {
    console.log(chalk.yellow('  ⚠️  This directory is not empty.\n'));
    const proceed = await confirm('  Continue anyway? (Existing files may be overwritten)');
    if (!proceed) {
      console.log(chalk.gray('\n  Run this command in an empty directory.\n'));
      return;
    }
  }

  // Ask about experience level (user must decide - AI can't know this)
  console.log(chalk.white('\n  What\'s your experience level?\n'));
  console.log(chalk.gray('    1. ') + chalk.cyan('Beginner') + chalk.gray(' - New to coding, explain everything'));
  console.log(chalk.gray('    2. ') + chalk.cyan('Intermediate') + chalk.gray(' - Know some coding, brief explanations'));
  console.log(chalk.gray('    3. ') + chalk.cyan('Advanced') + chalk.gray(' - Skip explanations, just build\n'));

  let experienceLevel = '';
  while (!['1', '2', '3'].includes(experienceLevel)) {
    experienceLevel = await prompt('  Enter 1, 2, or 3: ');
  }

  const isBeginnerMode = experienceLevel === '1';

  // Select stack with explanations for beginners
  console.log(chalk.white('\n  Select your stack:\n'));

  console.log(chalk.gray('    0. ') + chalk.magenta('You Decide') + chalk.gray(' - Let AI pick the best option'));
  if (isBeginnerMode) {
    console.log(chalk.gray('    1. ') + chalk.cyan('Next.js + Supabase + Drizzle') + chalk.green(' (Recommended)'));
    console.log(chalk.gray('       ') + chalk.dim('Next.js = Framework for building websites with React'));
    console.log(chalk.gray('       ') + chalk.dim('Supabase = Database + user login (like Firebase, but open source)'));
    console.log(chalk.gray('       ') + chalk.dim('Drizzle = Tool to talk to your database safely'));
    console.log('');
    console.log(chalk.gray('    2. ') + chalk.cyan('Next.js + Prisma') + chalk.gray(' (Coming soon)'));
    console.log(chalk.gray('       ') + chalk.dim('Prisma = Another database tool, more popular but heavier'));
    console.log('');
    console.log(chalk.gray('    3. ') + chalk.cyan('Express API') + chalk.gray(' (Coming soon)'));
    console.log(chalk.gray('       ') + chalk.dim('Express = Lightweight server, good for APIs without a frontend'));
    console.log('');
  } else {
    console.log(chalk.gray('    1. ') + chalk.cyan('Next.js + Supabase + Drizzle') + chalk.green(' (Recommended)'));
    console.log(chalk.gray('    2. ') + chalk.cyan('Next.js + Prisma') + chalk.gray(' (Coming soon)'));
    console.log(chalk.gray('    3. ') + chalk.cyan('Express API') + chalk.gray(' (Coming soon)\n'));
  }

  let stackChoice = '';
  while (!['0', '1', '2', '3'].includes(stackChoice)) {
    stackChoice = await prompt('  Enter 0, 1, 2, or 3: ');
  }

  // "You Decide" defaults to recommended stack
  if (stackChoice === '0') {
    console.log(chalk.magenta('  → AI chose: Next.js + Supabase + Drizzle (recommended)\n'));
    stackChoice = '1';
  }

  if (stackChoice !== '1') {
    console.log(chalk.yellow('\n  That stack is coming soon! Using Next.js + Supabase + Drizzle.\n'));
    stackChoice = '1';
  }

  // Explain what we're about to create for beginners
  if (isBeginnerMode) {
    console.log(chalk.blue('\n  ═══════════════════════════════════════════════════════════'));
    console.log(chalk.white.bold('  📚 What we\'re creating:'));
    console.log(chalk.blue('  ═══════════════════════════════════════════════════════════\n'));
    console.log(chalk.gray('  This will create a complete web application with:'));
    console.log(chalk.gray('  • A website users can visit (Next.js)'));
    console.log(chalk.gray('  • User signup/login system (Supabase Auth)'));
    console.log(chalk.gray('  • A database to store data (PostgreSQL via Supabase)'));
    console.log(chalk.gray('  • Beautiful styling system (Tailwind CSS)'));
    console.log(chalk.gray('  • Type safety to prevent bugs (TypeScript)\n'));
    console.log(chalk.gray('  Think of it like a house:'));
    console.log(chalk.gray('  • Next.js is the structure (walls, roof)'));
    console.log(chalk.gray('  • Supabase is the utilities (electricity, plumbing)'));
    console.log(chalk.gray('  • Tailwind is the interior design (paint, furniture)\n'));
  }

  // Get project name
  const defaultName = cwd.split(/[\\/]/).pop() || 'my-project';
  const projectName = await prompt(`  Project name (${defaultName}): `) || defaultName;

  console.log(chalk.green(`\n  Creating ${projectName} with Next.js + Supabase + Drizzle...\n`));

  // Create project structure
  const spinner = ora('  Creating project structure...').start();

  try {
    // Create directories
    const dirs = [
      'src/app',
      'src/components',
      'src/lib/supabase',
      'src/db',
      'src/db/migrations',
      'src/services',
      'src/types',
      'public',
    ];

    for (const dir of dirs) {
      const dirPath = join(cwd, dir);
      if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
      }
    }

    spinner.text = '  Writing configuration files...';

    // Write package.json
    const packageJson = { ...templates.PACKAGE_JSON, name: projectName };
    writeFileSync(join(cwd, 'package.json'), JSON.stringify(packageJson, null, 2));

    // Write .env.example
    writeFileSync(join(cwd, '.env.example'), templates.ENV_EXAMPLE);
    writeFileSync(join(cwd, '.env.local'), templates.ENV_EXAMPLE);

    // Write config files
    writeFileSync(join(cwd, 'drizzle.config.ts'), templates.DRIZZLE_CONFIG);
    writeFileSync(join(cwd, 'tailwind.config.ts'), templates.TAILWIND_CONFIG);
    writeFileSync(join(cwd, 'postcss.config.mjs'), templates.POSTCSS_CONFIG);
    writeFileSync(join(cwd, 'tsconfig.json'), JSON.stringify(templates.TSCONFIG, null, 2));
    writeFileSync(join(cwd, 'next.config.ts'), templates.NEXT_CONFIG);
    writeFileSync(join(cwd, '.gitignore'), templates.GITIGNORE);

    spinner.text = '  Writing source files...';

    // Write Supabase files
    writeFileSync(join(cwd, 'src/lib/supabase/server.ts'), templates.SUPABASE_SERVER);
    writeFileSync(join(cwd, 'src/lib/supabase/client.ts'), templates.SUPABASE_CLIENT);
    writeFileSync(join(cwd, 'src/lib/supabase/middleware.ts'), templates.SUPABASE_MIDDLEWARE);

    // Write middleware
    writeFileSync(join(cwd, 'middleware.ts'), templates.MIDDLEWARE);

    // Write database files
    writeFileSync(join(cwd, 'src/db/schema.ts'), templates.DB_SCHEMA);
    writeFileSync(join(cwd, 'src/db/index.ts'), templates.DB_INDEX);

    // Write app files
    writeFileSync(join(cwd, 'src/app/globals.css'), templates.GLOBALS_CSS);
    writeFileSync(join(cwd, 'src/app/layout.tsx'), templates.LAYOUT_TSX);
    writeFileSync(join(cwd, 'src/app/page.tsx'), templates.PAGE_TSX);

    // Write utils
    writeFileSync(join(cwd, 'src/lib/utils.ts'), templates.UTILS_CN);

    spinner.succeed('Project structure created!');

    // Ask about installing dependencies
    console.log('');
    const installDeps = await confirm('  Install dependencies with npm?');

    if (installDeps) {
      const installSpinner = ora('  Installing dependencies (this may take a minute)...').start();
      try {
        execSync('npm install', { cwd, stdio: 'pipe' });
        installSpinner.succeed('Dependencies installed!');
      } catch (error) {
        installSpinner.warn('Could not install dependencies automatically');
        console.log(chalk.gray('  Run `npm install` manually.\n'));
      }
    }

    spinner.succeed('Project structure created!');

    // Auto-install CodeBakers patterns
    console.log(chalk.white('\n  Installing CodeBakers patterns...\n'));

    const apiKey = getApiKey();
    let patternsInstalled = false;

    if (apiKey) {
      const patternSpinner = ora('  Downloading patterns...').start();

      try {
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/content`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        });

        if (response.ok) {
          const content: ContentResponse = await response.json();

          // Write CLAUDE.md (main router)
          if (content.router) {
            writeFileSync(join(cwd, 'CLAUDE.md'), content.router);
          }

          // Write pattern modules to .claude/
          if (content.modules && Object.keys(content.modules).length > 0) {
            const modulesDir = join(cwd, '.claude');
            if (!existsSync(modulesDir)) {
              mkdirSync(modulesDir, { recursive: true });
            }
            for (const [name, data] of Object.entries(content.modules)) {
              writeFileSync(join(modulesDir, name), data);
            }
          }

          // Write project management files
          writeFileSync(join(cwd, 'PRD.md'), createPrdTemplate(projectName));
          writeFileSync(join(cwd, 'PROJECT-STATE.md'), createProjectState(projectName));
          writeFileSync(join(cwd, 'PROJECT-CONTEXT.md'), createProjectContext(projectName));
          writeFileSync(join(cwd, 'DECISIONS.md'), createDecisionsLog(projectName));

          // Write Cursor IDE files
          writeFileSync(join(cwd, '.cursorrules'), CURSORRULES_TEMPLATE);
          writeFileSync(join(cwd, '.cursorignore'), CURSORIGNORE_TEMPLATE);

          // Create .vscode settings
          const vscodeDir = join(cwd, '.vscode');
          if (!existsSync(vscodeDir)) {
            mkdirSync(vscodeDir, { recursive: true });
          }
          writeFileSync(join(vscodeDir, 'settings.json'), JSON.stringify({
            "cursor.chat.defaultContext": ["CLAUDE.md", "PRD.md", "PROJECT-CONTEXT.md"],
            "cursor.chat.alwaysIncludeRules": true
          }, null, 2));

          // Update .gitignore
          const gitignorePath = join(cwd, '.gitignore');
          if (existsSync(gitignorePath)) {
            const gitignore = readFileSync(gitignorePath, 'utf-8');
            if (!gitignore.includes('.cursorrules')) {
              writeFileSync(gitignorePath, gitignore + '\n# CodeBakers\n.cursorrules\n.claude/\n');
            }
          }

          patternSpinner.succeed(`Patterns installed! (v${content.version})`);
          patternsInstalled = true;
        } else {
          patternSpinner.warn('Could not download patterns (will need to run codebakers init later)');
        }
      } catch {
        patternSpinner.warn('Could not download patterns (will need to run codebakers init later)');
      }
    } else {
      console.log(chalk.yellow('  ⚠️  Not logged in - run `codebakers setup` first to get patterns\n'));
    }

    // Ask about auto-provisioning
    console.log(chalk.white('\n  Would you like to auto-provision your infrastructure?\n'));
    console.log(chalk.gray('    This can create GitHub repo, Supabase database, and Vercel project automatically.'));
    console.log(chalk.gray('    You\'ll need API keys for each service (one-time setup).\n'));

    const wantProvision = await confirm('  Auto-provision services?');
    let provisionResult: ProvisionResult = {};

    if (wantProvision) {
      // Check for saved keys in CodeBakers back office
      const serverKeys = await fetchServerKeys();
      const hasServerKeys = serverKeys && (serverKeys.github || serverKeys.supabase || serverKeys.vercel);
      const localGithub = getServiceKey('github');
      const localSupabase = getServiceKey('supabase');
      const localVercel = getServiceKey('vercel');
      const hasLocalKeys = localGithub || localSupabase || localVercel;

      if (hasServerKeys || hasLocalKeys) {
        // Show which keys are available
        console.log(chalk.white('\n  Available service keys:\n'));

        if (hasServerKeys) {
          console.log(chalk.gray('    From CodeBakers account:'));
          if (serverKeys?.github) console.log(chalk.green('      ✓ GitHub'));
          if (serverKeys?.supabase) console.log(chalk.green('      ✓ Supabase'));
          if (serverKeys?.vercel) console.log(chalk.green('      ✓ Vercel'));
        }

        if (hasLocalKeys) {
          console.log(chalk.gray('    Stored locally:'));
          if (localGithub) console.log(chalk.green('      ✓ GitHub'));
          if (localSupabase) console.log(chalk.green('      ✓ Supabase'));
          if (localVercel) console.log(chalk.green('      ✓ Vercel'));
        }

        console.log('');

        // Ask which keys to use
        console.log(chalk.white('  Which keys would you like to use?\n'));
        console.log(chalk.gray('    1. ') + chalk.cyan('Use saved keys') + chalk.gray(' - Use keys from your account/local storage'));
        console.log(chalk.gray('    2. ') + chalk.cyan('Enter new keys') + chalk.gray(' - For a client project or different account'));
        console.log(chalk.gray('    3. ') + chalk.cyan('Skip') + chalk.gray(' - Don\'t provision, I\'ll do it manually\n'));

        let keyChoice = '';
        while (!['1', '2', '3'].includes(keyChoice)) {
          keyChoice = await prompt('  Enter 1, 2, or 3: ');
        }

        if (keyChoice === '3') {
          console.log(chalk.gray('\n  Skipping auto-provisioning.\n'));
        } else {
          if (keyChoice === '1' && hasServerKeys) {
            // Sync server keys to local storage for this session
            syncKeysToLocal(serverKeys!);
            console.log(chalk.green('\n  ✓ Using saved keys from CodeBakers account\n'));
          } else if (keyChoice === '2') {
            // Clear local keys so provision.ts will prompt for new ones
            console.log(chalk.gray('\n  You\'ll be prompted to enter keys for each service.\n'));
          }

          // Initialize git first if not already
          try {
            execSync('git init', { cwd, stdio: 'pipe' });
            execSync('git add .', { cwd, stdio: 'pipe' });
            execSync('git commit -m "Initial commit from CodeBakers scaffold"', { cwd, stdio: 'pipe' });
          } catch {
            // Git might already be initialized or have issues
          }

          provisionResult = await provisionAll(projectName, `${projectName} - Built with CodeBakers`);
        }
      } else {
        // No saved keys - proceed with provisioning (will prompt for keys)
        console.log(chalk.gray('\n  No saved keys found. You\'ll be prompted to enter keys for each service.\n'));
        console.log(chalk.gray('  Tip: Save keys in your CodeBakers dashboard to auto-provision future projects!\n'));

        // Initialize git first if not already
        try {
          execSync('git init', { cwd, stdio: 'pipe' });
          execSync('git add .', { cwd, stdio: 'pipe' });
          execSync('git commit -m "Initial commit from CodeBakers scaffold"', { cwd, stdio: 'pipe' });
        } catch {
          // Git might already be initialized or have issues
        }

        provisionResult = await provisionAll(projectName, `${projectName} - Built with CodeBakers`);
      }

      // Update .env.local with Supabase credentials if available
      if (provisionResult.supabase) {
        const envPath = join(cwd, '.env.local');
        let envContent = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';

        // Replace placeholder values with actual credentials
        envContent = envContent
          .replace('your-project-id.supabase.co', provisionResult.supabase.apiUrl.replace('https://', ''))
          .replace('your-anon-key', provisionResult.supabase.anonKey || 'your-anon-key');

        writeFileSync(envPath, envContent);
        console.log(chalk.green('  ✅ Updated .env.local with Supabase credentials!\n'));
      }
    }

    // Success message
    console.log(chalk.green(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   ${chalk.bold('✓ Project created successfully!')}                       ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
    `));

    console.log(chalk.white('  What was created:\n'));
    if (isBeginnerMode) {
      console.log(chalk.gray('    src/'));
      console.log(chalk.gray('    ├── app/           ') + chalk.cyan('← Your pages (what users see)'));
      console.log(chalk.gray('    ├── components/    ') + chalk.cyan('← Reusable UI pieces (buttons, forms)'));
      console.log(chalk.gray('    ├── lib/           ') + chalk.cyan('← Helper code & connections'));
      console.log(chalk.gray('    │   └── supabase/  ') + chalk.cyan('← Login & database connection'));
      console.log(chalk.gray('    ├── db/            ') + chalk.cyan('← Database structure (tables)'));
      console.log(chalk.gray('    ├── services/      ') + chalk.cyan('← Core app logic (what your app does)'));
      console.log(chalk.gray('    └── types/         ') + chalk.cyan('← Data shape definitions'));
    } else {
      console.log(chalk.gray('    src/'));
      console.log(chalk.gray('    ├── app/           ') + chalk.cyan('← Pages & layouts'));
      console.log(chalk.gray('    ├── components/    ') + chalk.cyan('← React components'));
      console.log(chalk.gray('    ├── lib/           ') + chalk.cyan('← Utilities & clients'));
      console.log(chalk.gray('    │   └── supabase/  ') + chalk.cyan('← Supabase clients (ready!)'));
      console.log(chalk.gray('    ├── db/            ') + chalk.cyan('← Database schema & queries'));
      console.log(chalk.gray('    ├── services/      ') + chalk.cyan('← Business logic'));
      console.log(chalk.gray('    └── types/         ') + chalk.cyan('← TypeScript types'));
    }

    if (patternsInstalled) {
      console.log('');
      console.log(chalk.gray('    CLAUDE.md          ') + chalk.cyan('← AI instructions (reads automatically!)'));
      console.log(chalk.gray('    PRD.md             ') + chalk.cyan('← Your product requirements'));
      console.log(chalk.gray('    .claude/           ') + chalk.cyan('← 34 production patterns'));
    }
    console.log('');

    console.log(chalk.white('  Next steps:\n'));
    if (isBeginnerMode) {
      console.log(chalk.cyan('    1. ') + chalk.white('Set up Supabase (free database + login):'));
      console.log(chalk.gray('       Go to https://supabase.com → Create free account → New Project'));
      console.log('');
      console.log(chalk.cyan('    2. ') + chalk.white('Connect your project:'));
      console.log(chalk.gray('       Open .env.local file and paste your Supabase credentials'));
      console.log(chalk.gray('       (Found in Supabase: Settings → API)'));
      console.log('');
      console.log(chalk.cyan('    3. ') + chalk.white('Start your app:'));
      console.log(chalk.gray('       Run: npm run dev'));
      console.log(chalk.gray('       Open: http://localhost:3000 in your browser'));
      console.log('');
      console.log(chalk.cyan('    4. ') + chalk.white('Start building!'));
      console.log(chalk.gray('       Tell your AI: "Build me a [feature]"'));
      console.log(chalk.gray('       The AI already has all the patterns loaded!\n'));
    } else {
      console.log(chalk.cyan('    1. ') + chalk.gray('Update .env.local with your Supabase credentials'));
      console.log(chalk.cyan('    2. ') + chalk.gray('Run `npm run dev` to start development'));
      console.log(chalk.cyan('    3. ') + chalk.gray('Tell your AI what to build - patterns are already loaded!\n'));

      console.log(chalk.white('  Supabase setup:\n'));
      console.log(chalk.gray('    1. Create a project at https://supabase.com'));
      console.log(chalk.gray('    2. Go to Settings → API'));
      console.log(chalk.gray('    3. Copy URL and anon key to .env.local'));
      console.log(chalk.gray('    4. Go to Settings → Database → Connection string'));
      console.log(chalk.gray('    5. Copy DATABASE_URL to .env.local\n'));
    }

  } catch (error) {
    spinner.fail('Project scaffolding failed');
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`\n  Error: ${message}\n`));
    process.exit(1);
  }
}
