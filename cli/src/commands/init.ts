import chalk from 'chalk';
import ora from 'ora';
import { createInterface } from 'readline';
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync, statSync, rmSync } from 'fs';
import { join } from 'path';
import { setApiKey, getApiKey, getApiUrl } from '../config.js';
import { audit } from './audit.js';
import { heal } from './heal.js';

// ============================================================================
// TEMPLATES
// ============================================================================

const CLAUDE_MD_BOOTSTRAP = `# CodeBakers

**MANDATORY: Before writing ANY code, call the \`discover_patterns\` MCP tool.**

\`\`\`
Tool: discover_patterns
Args: { task: "description of what you're building" }
\`\`\`

The server will return:
- All coding patterns and rules you must follow
- Test requirements
- Validation instructions

**You cannot write code without calling this tool first. The server tracks compliance.**
`;

const CURSORRULES_TEMPLATE = `# CODEBAKERS CURSOR RULES
# Zero-friction AI assistance - everything is automatic

## ON EVERY MESSAGE - AUTOMATIC WORKFLOW

### PHASE 1: CONTEXT LOAD (automatic)
1. Read CLAUDE.md → Load router
2. Read PROJECT-CONTEXT.md → Understand codebase
3. Read PROJECT-STATE.md → Check what's in progress
4. Read DECISIONS.md → Know past decisions

### PHASE 2: PRE-FLIGHT CHECK (before writing code)
Ask yourself silently:
- [ ] What existing code does this touch? (check PROJECT-CONTEXT.md)
- [ ] Is similar code already in the codebase? (copy that pattern)
- [ ] What's the data model involved?
- [ ] What are the error cases?

### PHASE 3: EXECUTE
- State: \`📋 CodeBakers | [Type] | Server-Enforced\`
- Call discover_patterns MCP tool first
- Follow patterns from server EXACTLY

### PHASE 4: SELF-REVIEW (before saying "done")
- [ ] TypeScript compiles? (npx tsc --noEmit)
- [ ] Imports resolve correctly?
- [ ] Error handling exists?
- [ ] Matches existing patterns in codebase?
- [ ] Tests written?
- [ ] PROJECT-STATE.md updated?

If ANY check fails, fix it before responding.

### PHASE 5: UPDATE STATE
- Update PROJECT-STATE.md with completed work
- Add to DECISIONS.md if architectural choice was made
- Update .codebakers/DEVLOG.md with session summary

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
*.tsbuildinfo

# Logs
logs/
*.log

# Environment files (don't leak secrets)
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

const VSCODE_SETTINGS_TEMPLATE = {
  "cursor.chat.defaultContext": [
    "CLAUDE.md",
    "PROJECT-CONTEXT.md",
    "PROJECT-STATE.md",
    "DECISIONS.md"
  ],
  "cursor.chat.alwaysIncludeRules": true,
  "cursor.composer.alwaysIncludeRules": true,
  "cursor.general.enableAutoImport": true
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

type ProjectType = 'personal' | 'client' | 'business';

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

async function confirm(question: string): Promise<boolean> {
  const answer = await prompt(`${question} (Y/n): `);
  return answer.toLowerCase() !== 'n';
}

function countSourceFiles(dir: string): number {
  let count = 0;
  try {
    const items = readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      if (item.name.startsWith('.') || item.name === 'node_modules') continue;

      const fullPath = join(dir, item.name);
      if (item.isDirectory()) {
        count += countSourceFiles(fullPath);
      } else if (
        item.name.endsWith('.ts') ||
        item.name.endsWith('.tsx') ||
        item.name.endsWith('.js') ||
        item.name.endsWith('.jsx')
      ) {
        count++;
      }
    }
  } catch {
    // Ignore access errors
  }
  return count;
}

function detectExistingProject(cwd: string): { exists: boolean; files: number; details: string[]; stack: Record<string, string> } {
  const details: string[] = [];
  const stack: Record<string, string> = {};
  let sourceFileCount = 0;

  // Check for package.json with dependencies
  const packageJsonPath = join(cwd, 'package.json');
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      const depCount = Object.keys(pkg.dependencies || {}).length;

      if (depCount > 0) {
        details.push(`package.json with ${depCount} dependencies`);
      }

      // Detect stack
      if (deps['next']) stack.framework = `Next.js ${deps['next']}`;
      else if (deps['react']) stack.framework = `React ${deps['react']}`;
      else if (deps['vue']) stack.framework = `Vue ${deps['vue']}`;
      else if (deps['express']) stack.framework = `Express ${deps['express']}`;

      if (deps['drizzle-orm']) stack.database = 'Drizzle ORM';
      else if (deps['prisma']) stack.database = 'Prisma';
      else if (deps['mongoose']) stack.database = 'MongoDB/Mongoose';

      if (deps['@supabase/supabase-js']) stack.auth = 'Supabase Auth';
      else if (deps['next-auth']) stack.auth = 'NextAuth.js';
      else if (deps['@clerk/nextjs']) stack.auth = 'Clerk';

      if (deps['tailwindcss']) stack.styling = 'Tailwind CSS';
      if (deps['typescript'] || existsSync(join(cwd, 'tsconfig.json'))) {
        stack.language = 'TypeScript';
      } else {
        stack.language = 'JavaScript';
      }

      if (deps['vitest']) stack.testing = 'Vitest';
      else if (deps['jest']) stack.testing = 'Jest';
      else if (deps['@playwright/test']) stack.testing = 'Playwright';
    } catch {
      // Ignore parse errors
    }
  }

  // Check for source directories
  const sourceDirs = ['src', 'app', 'pages', 'components', 'lib'];
  for (const dir of sourceDirs) {
    const dirPath = join(cwd, dir);
    if (existsSync(dirPath)) {
      try {
        if (statSync(dirPath).isDirectory()) {
          const files = countSourceFiles(dirPath);
          if (files > 0) {
            sourceFileCount += files;
            details.push(`${dir}/ with ${files} source files`);
          }
        }
      } catch {
        // Ignore access errors
      }
    }
  }

  // Check for common config files
  const configFiles = ['tsconfig.json', 'next.config.js', 'next.config.mjs', 'vite.config.ts', 'tailwind.config.js'];
  for (const file of configFiles) {
    if (existsSync(join(cwd, file))) {
      details.push(file);
    }
  }

  return {
    exists: sourceFileCount > 5 || details.length >= 3,
    files: sourceFileCount,
    details,
    stack
  };
}

function buildStructureString(cwd: string): string {
  try {
    const items = readdirSync(cwd);
    const dirs: string[] = [];
    const files: string[] = [];

    for (const item of items) {
      if (item.startsWith('.') || item === 'node_modules') continue;
      const fullPath = join(cwd, item);
      try {
        if (statSync(fullPath).isDirectory()) {
          dirs.push(item + '/');
        } else {
          files.push(item);
        }
      } catch {
        // Skip inaccessible items
      }
    }

    return [...dirs.sort(), ...files.sort()].join('\n');
  } catch {
    return '[Could not scan structure]';
  }
}

// ============================================================================
// FILE CREATION FUNCTIONS
// ============================================================================

function createProjectContext(projectName: string, stack: Record<string, string>, structure: string, isExisting: boolean): string {
  const date = new Date().toISOString().split('T')[0];
  return `# PROJECT CONTEXT
# Last Scanned: ${date}
# Mode: ${isExisting ? 'Existing Project' : 'New Project'}

## Overview
name: ${projectName}
description: ${isExisting ? '[Existing project - AI will analyze on first interaction]' : '[AI will fill after first feature]'}

## Tech Stack
framework: ${stack.framework || '[Not detected]'}
language: ${stack.language || '[Not detected]'}
database: ${stack.database || '[Not detected]'}
auth: ${stack.auth || '[Not detected]'}
styling: ${stack.styling || '[Not detected]'}
testing: ${stack.testing || '[Not detected]'}

## Project Structure
\`\`\`
${structure || '[Empty project]'}
\`\`\`

## Key Files
<!-- AI: List the most important files for understanding the project -->
- Entry point: ${stack.framework?.includes('Next') ? 'src/app/page.tsx or pages/index.tsx' : '[AI will identify]'}
- Config: ${existsSync(join(process.cwd(), 'tsconfig.json')) ? 'tsconfig.json' : '[AI will identify]'}
- Database schema: [AI will identify]
- API routes: ${stack.framework?.includes('Next') ? 'src/app/api/ or pages/api/' : '[AI will identify]'}

## Existing Patterns
<!-- AI: Document patterns you find so you can reuse them -->

### API Route Pattern
\`\`\`typescript
[AI: Copy an example API route pattern from this project]
\`\`\`

### Component Pattern
\`\`\`typescript
[AI: Copy an example component pattern from this project]
\`\`\`

## Environment Variables
<!-- AI: List required env vars (don't include values!) -->
${existsSync(join(process.cwd(), '.env.example')) ? '[Check .env.example]' : '- [ ] [AI will identify required vars]'}

## Notes
<!-- AI: Any important context about this specific project -->
`;
}

function createProjectState(projectName: string, isExisting: boolean): string {
  const date = new Date().toISOString().split('T')[0];
  return `# PROJECT STATE
# Last Updated: ${date}
# Auto-maintained by AI - update when starting/completing tasks

## Project Info
name: ${projectName}
phase: ${isExisting ? 'active' : 'planning'}
mode: ${isExisting ? 'existing-project' : 'new-project'}

## Current Sprint
Goal: ${isExisting ? '[AI will identify based on conversation]' : '[Define in first conversation]'}

## In Progress
<!-- AI: Add tasks here when you START working on them -->
<!-- Format: - [task] (started: date, agent: cursor/claude) -->

## Completed
<!-- AI: Move tasks here when DONE -->
<!-- Format: - [task] (completed: date) -->
${isExisting ? `\n- CodeBakers integration (completed: ${date})` : ''}

## Blockers
<!-- AI: List anything blocking progress -->

## Next Up
<!-- AI: Queue of upcoming tasks -->
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

## ${date}: CodeBakers Initialized
**Decision:** Using CodeBakers server-enforced pattern system
**Reason:** Ensure consistent, production-quality code
**Pattern:** Server-enforced via discover_patterns MCP tool

---

<!-- AI: Add new decisions above this line -->
`;
}

function createDevlog(projectName: string, isExisting: boolean, auditScore?: number): string {
  const date = new Date().toISOString().split('T')[0];
  const timestamp = new Date().toISOString();

  return `# Development Log
# Project: ${projectName}

## ${date} - CodeBakers Integration
**Session:** ${timestamp}
**Task Size:** MEDIUM
**Status:** Completed

### What was done:
- Integrated CodeBakers into ${isExisting ? 'existing' : 'new'} project
- Created project tracking files
- Set up Cursor IDE configuration
${isExisting && auditScore !== undefined ? `- Ran initial code audit (Score: ${auditScore}%)` : ''}

### Files created:
- \`CLAUDE.md\` - AI bootstrap file
- \`.cursorrules\` - Cursor IDE rules
- \`PROJECT-CONTEXT.md\` - Project knowledge base
- \`PROJECT-STATE.md\` - Task tracking
- \`DECISIONS.md\` - Architecture log
- \`.codebakers/DEVLOG.md\` - This file

### Next steps:
${isExisting ? '- Start using AI assistance with existing codebase' : '- Define project requirements in first conversation'}
${isExisting ? '- AI will analyze existing patterns on first interaction' : '- AI will help scaffold initial features'}

---
`;
}

function createPrdTemplate(projectName: string, projectType: string): string {
  const date = new Date().toISOString().split('T')[0];

  const typeSpecificSections = projectType === 'client'
    ? `
## Client Info
- Client Name: [Who is this for?]
- Contact: [Primary contact]
- Deadline: [When is this due?]
`
    : projectType === 'business'
    ? `
## Business Context
- Target Market: [Who are you selling to?]
- Revenue Model: [How does this make money?]
- MVP Deadline: [When do you need to launch?]
`
    : `
## Personal Goals
- Why am I building this? [Your motivation]
- Learning goals: [What do you want to learn?]
`;

  return `# Product Requirements Document
# Project: ${projectName}
# Created: ${date}
# Type: ${projectType}

## Overview
**One-liner:** [Describe this project in one sentence]

**Problem:** [What problem does this solve?]

**Solution:** [How does this solve it?]
${typeSpecificSections}
## Target Users
- **Primary:** [Who is the main user?]
- **Secondary:** [Other users?]

## Core Features (MVP)
1. [ ] **Feature 1:** [Description]
2. [ ] **Feature 2:** [Description]
3. [ ] **Feature 3:** [Description]

## Nice-to-Have Features (Post-MVP)
1. [ ] [Feature description]
2. [ ] [Feature description]

## Technical Requirements
- **Must use:** [Required technologies, APIs, etc.]
- **Must avoid:** [Things you don't want]

## Success Metrics
- [ ] [How will you measure success?]
- [ ] [What does "done" look like?]

---
<!-- AI reads this file to understand what to build -->
`;
}

// ============================================================================
// GUIDED QUESTIONS
// ============================================================================

interface GuidedAnswers {
  oneLiner: string;
  problem: string;
  users: string;
  features: string[];
  auth: boolean;
  payments: boolean;
  integrations: string;
  deadline: string;
}

async function runGuidedQuestions(): Promise<GuidedAnswers> {
  console.log(chalk.cyan('\n  ━━━ Let\'s define your project ━━━\n'));
  console.log(chalk.gray('  Answer these questions (press Enter to skip any)\n'));

  // One-liner
  console.log(chalk.white('  1. What are you building?\n'));
  const oneLiner = await prompt('     ') || 'A web application';

  // Problem
  console.log(chalk.white('\n  2. What problem does this solve?\n'));
  const problem = await prompt('     ') || '';

  // Users
  console.log(chalk.white('\n  3. Who will use this?\n'));
  console.log(chalk.gray('     (e.g., "small business owners", "freelancers", "developers")\n'));
  const users = await prompt('     ') || 'General users';

  // Features
  console.log(chalk.white('\n  4. What are the 3 must-have features?\n'));
  console.log(chalk.gray('     (Enter each feature, then press Enter. Type "done" when finished)\n'));
  const features: string[] = [];
  for (let i = 0; i < 5; i++) {
    const feature = await prompt(`     Feature ${i + 1}: `);
    if (!feature || feature.toLowerCase() === 'done') break;
    features.push(feature);
  }

  // Auth
  console.log(chalk.white('\n  5. Do users need to create accounts?\n'));
  const authAnswer = await prompt('     (y/n): ');
  const auth = authAnswer.toLowerCase() === 'y' || authAnswer.toLowerCase() === 'yes';

  // Payments
  console.log(chalk.white('\n  6. Will you charge money?\n'));
  const paymentsAnswer = await prompt('     (y/n): ');
  const payments = paymentsAnswer.toLowerCase() === 'y' || paymentsAnswer.toLowerCase() === 'yes';

  // Integrations
  console.log(chalk.white('\n  7. Any specific integrations needed?\n'));
  console.log(chalk.gray('     (e.g., "Stripe, SendGrid, Twilio" or press Enter to skip)\n'));
  const integrations = await prompt('     ') || '';

  // Deadline
  console.log(chalk.white('\n  8. When do you need this done?\n'));
  console.log(chalk.gray('     (e.g., "2 weeks", "end of month", or press Enter to skip)\n'));
  const deadline = await prompt('     ') || '';

  console.log(chalk.green('\n  ✓ Got it! Creating your PRD...\n'));

  return { oneLiner, problem, users, features, auth, payments, integrations, deadline };
}

function createPrdFromAnswers(
  projectName: string,
  projectType: string,
  answers: GuidedAnswers
): string {
  const date = new Date().toISOString().split('T')[0];

  const featuresSection = answers.features.length > 0
    ? answers.features.map((f, i) => `${i + 1}. [ ] **${f}**`).join('\n')
    : '1. [ ] **Feature 1:** [To be defined]\n2. [ ] **Feature 2:** [To be defined]';

  const techRequirements: string[] = [];
  if (answers.auth) techRequirements.push('User authentication (Supabase Auth)');
  if (answers.payments) techRequirements.push('Payment processing (Stripe)');
  if (answers.integrations) techRequirements.push(answers.integrations);

  return `# Product Requirements Document
# Project: ${projectName}
# Created: ${date}
# Type: ${projectType}

## Overview
**One-liner:** ${answers.oneLiner}

**Problem:** ${answers.problem || '[To be refined]'}

**Solution:** ${answers.oneLiner}

## Target Users
- **Primary:** ${answers.users}

## Core Features (MVP)
${featuresSection}

## Technical Requirements
${techRequirements.length > 0 ? techRequirements.map(t => `- ${t}`).join('\n') : '- [No specific requirements noted]'}

## Timeline
${answers.deadline ? `- **Target:** ${answers.deadline}` : '- [No deadline specified]'}

## Notes
- Authentication: ${answers.auth ? 'Yes - users need accounts' : 'No - public access'}
- Payments: ${answers.payments ? 'Yes - will charge users' : 'No - free to use'}

---
<!-- Generated from guided questions - AI reads this to build your project -->
`;
}

// ============================================================================
// SHARED SETUP FUNCTIONS
// ============================================================================

async function ensureLoggedIn(): Promise<string> {
  let apiKey = getApiKey();

  if (apiKey) {
    console.log(chalk.green('  ✓ Already logged in\n'));
    const useExisting = await confirm('  Use existing API key?');
    if (useExisting) return apiKey;
    apiKey = null;
  }

  console.log(chalk.white('\n  Login to CodeBakers\n'));
  console.log(chalk.gray('  Go to: ') + chalk.cyan('https://codebakers.ai/dashboard'));
  console.log(chalk.gray('  Copy your API key (starts with cb_)\n'));

  apiKey = await prompt('  Paste your API key: ');

  if (!apiKey || !apiKey.startsWith('cb_')) {
    console.log(chalk.red('\n  ✗ Invalid API key. Keys start with "cb_"\n'));
    process.exit(1);
  }

  const spinner = ora('  Validating API key...').start();

  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/content`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      throw new Error('Invalid API key');
    }

    setApiKey(apiKey);
    spinner.succeed('API key valid!');
    return apiKey;
  } catch (error) {
    spinner.fail('Invalid API key');
    process.exit(1);
  }
}

function installBootstrapFiles(cwd: string): void {
  const spinner = ora('  Installing bootstrap files...').start();

  try {
    writeFileSync(join(cwd, 'CLAUDE.md'), CLAUDE_MD_BOOTSTRAP);
    writeFileSync(join(cwd, '.cursorrules'), CURSORRULES_TEMPLATE);
    writeFileSync(join(cwd, '.cursorignore'), CURSORIGNORE_TEMPLATE);

    // Remove old .claude folder if it exists
    const claudeDir = join(cwd, '.claude');
    if (existsSync(claudeDir)) {
      try {
        rmSync(claudeDir, { recursive: true, force: true });
      } catch {
        // Ignore errors
      }
    }

    spinner.succeed('Bootstrap files installed!');
  } catch (error) {
    spinner.fail('Failed to install bootstrap files');
    throw error;
  }
}

function setupCursorIDE(cwd: string): void {
  const spinner = ora('  Setting up Cursor IDE...').start();

  try {
    // Global MCP config
    const homeDir = process.env.USERPROFILE || process.env.HOME || '';
    const globalCursorDir = join(homeDir, '.cursor');
    if (!existsSync(globalCursorDir)) {
      mkdirSync(globalCursorDir, { recursive: true });
    }

    const mcpConfigPath = join(globalCursorDir, 'mcp.json');
    const isWindows = process.platform === 'win32';
    const mcpConfig = {
      mcpServers: {
        codebakers: isWindows
          ? { command: 'cmd', args: ['/c', 'npx', '-y', '@codebakers/cli', 'serve'] }
          : { command: 'npx', args: ['-y', '@codebakers/cli', 'serve'] }
      }
    };

    if (existsSync(mcpConfigPath)) {
      try {
        const existing = JSON.parse(readFileSync(mcpConfigPath, 'utf-8'));
        existing.mcpServers = { ...existing.mcpServers, ...mcpConfig.mcpServers };
        writeFileSync(mcpConfigPath, JSON.stringify(existing, null, 2));
      } catch {
        writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
      }
    } else {
      writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
    }

    // VSCode settings
    const vscodeDir = join(cwd, '.vscode');
    if (!existsSync(vscodeDir)) {
      mkdirSync(vscodeDir, { recursive: true });
    }

    const settingsPath = join(vscodeDir, 'settings.json');
    if (existsSync(settingsPath)) {
      const existing = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      writeFileSync(settingsPath, JSON.stringify({ ...existing, ...VSCODE_SETTINGS_TEMPLATE }, null, 2));
    } else {
      writeFileSync(settingsPath, JSON.stringify(VSCODE_SETTINGS_TEMPLATE, null, 2));
    }

    spinner.succeed('Cursor IDE configured!');
  } catch {
    spinner.warn('Could not configure Cursor IDE (continuing anyway)');
  }
}

function setupClaudeCode(): void {
  const spinner = ora('  Setting up Claude Code MCP...').start();

  try {
    const homeDir = process.env.USERPROFILE || process.env.HOME || '';
    let configPath: string;
    const isWindows = process.platform === 'win32';

    // Determine config path based on platform
    if (isWindows) {
      configPath = join(homeDir, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
    } else if (process.platform === 'darwin') {
      configPath = join(homeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    } else {
      configPath = join(homeDir, '.config', 'claude', 'claude_desktop_config.json');
    }

    // Ensure directory exists
    const configDir = join(configPath, '..');
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    // MCP config for Claude Code
    const mcpConfig = {
      mcpServers: {
        codebakers: isWindows
          ? { command: 'cmd', args: ['/c', 'npx', '-y', '@codebakers/cli', 'serve'] }
          : { command: 'npx', args: ['-y', '@codebakers/cli', 'serve'] }
      }
    };

    // Read existing or create new
    if (existsSync(configPath)) {
      try {
        const existing = JSON.parse(readFileSync(configPath, 'utf-8'));
        if (!existing.mcpServers) {
          existing.mcpServers = {};
        }
        existing.mcpServers.codebakers = mcpConfig.mcpServers.codebakers;
        writeFileSync(configPath, JSON.stringify(existing, null, 2));
      } catch {
        writeFileSync(configPath, JSON.stringify(mcpConfig, null, 2));
      }
    } else {
      writeFileSync(configPath, JSON.stringify(mcpConfig, null, 2));
    }

    spinner.succeed('Claude Code MCP configured!');
  } catch {
    spinner.warn('Could not configure Claude Code MCP (continuing anyway)');
  }
}

function updateGitignore(cwd: string): void {
  const gitignorePath = join(cwd, '.gitignore');
  if (existsSync(gitignorePath)) {
    const gitignore = readFileSync(gitignorePath, 'utf-8');
    if (!gitignore.includes('.cursorrules')) {
      writeFileSync(gitignorePath, gitignore + '\n# CodeBakers\n.cursorrules\n');
    }
  }
}

function createTrackingFiles(cwd: string, projectName: string, stack: Record<string, string>, structure: string, isExisting: boolean, auditScore?: number): void {
  const spinner = ora('  Creating project tracking files...').start();

  try {
    // Create .codebakers directory
    const codebakersDir = join(cwd, '.codebakers');
    if (!existsSync(codebakersDir)) {
      mkdirSync(codebakersDir, { recursive: true });
    }

    // PROJECT-CONTEXT.md
    writeFileSync(join(cwd, 'PROJECT-CONTEXT.md'), createProjectContext(projectName, stack, structure, isExisting));

    // PROJECT-STATE.md
    writeFileSync(join(cwd, 'PROJECT-STATE.md'), createProjectState(projectName, isExisting));

    // DECISIONS.md
    writeFileSync(join(cwd, 'DECISIONS.md'), createDecisionsLog(projectName));

    // .codebakers/DEVLOG.md
    writeFileSync(join(codebakersDir, 'DEVLOG.md'), createDevlog(projectName, isExisting, auditScore));

    // .codebakers.json state file
    const stateFile = join(cwd, '.codebakers.json');
    const state = {
      version: '1.0',
      serverEnforced: true,
      projectType: isExisting ? 'existing' : 'new',
      projectName,
      createdAt: new Date().toISOString(),
      stack,
      auditScore: auditScore
    };
    writeFileSync(stateFile, JSON.stringify(state, null, 2));

    spinner.succeed('Project tracking files created!');
  } catch (error) {
    spinner.warn('Some tracking files could not be created');
  }
}

// ============================================================================
// MODE: NEW PROJECT
// ============================================================================

async function initNewProject(cwd: string): Promise<void> {
  console.log(chalk.cyan('\n  ━━━ New Project Setup ━━━\n'));

  // Get project info
  console.log(chalk.white('  What kind of project is this?\n'));
  console.log(chalk.gray('    1. ') + chalk.cyan('PERSONAL') + chalk.gray(' - Just building for myself'));
  console.log(chalk.gray('    2. ') + chalk.cyan('CLIENT') + chalk.gray('   - Building for someone else'));
  console.log(chalk.gray('    3. ') + chalk.cyan('BUSINESS') + chalk.gray(' - My own product/startup\n'));

  let typeChoice = '';
  while (!['1', '2', '3'].includes(typeChoice)) {
    typeChoice = await prompt('  Enter 1, 2, or 3: ');
  }

  const typeMap: Record<string, ProjectType> = { '1': 'personal', '2': 'client', '3': 'business' };
  const projectType = typeMap[typeChoice];

  const defaultName = cwd.split(/[\\/]/).pop() || 'my-project';
  const projectName = await prompt(`  Project name (${defaultName}): `) || defaultName;

  console.log(chalk.green(`\n  ✓ Setting up "${projectName}" as ${projectType.toUpperCase()} project\n`));

  // Login
  await ensureLoggedIn();

  // Install files
  console.log(chalk.white('\n  Installing CodeBakers...\n'));
  installBootstrapFiles(cwd);

  // Create tracking files
  const structure = buildStructureString(cwd);
  createTrackingFiles(cwd, projectName, {}, structure, false);

  // Setup IDEs and MCP
  console.log('');
  setupCursorIDE(cwd);
  setupClaudeCode();

  // Update .gitignore
  updateGitignore(cwd);

  // How to describe project
  console.log(chalk.white('\n  📝 How would you like to describe your project?\n'));
  console.log(chalk.gray('    1. ') + chalk.cyan('GUIDED QUESTIONS') + chalk.gray(' - I\'ll ask you step by step'));
  console.log(chalk.gray('    2. ') + chalk.cyan('WRITE A PRD') + chalk.gray('      - Create a blank template to fill out'));
  console.log(chalk.gray('    3. ') + chalk.cyan('PASTE/UPLOAD PRD') + chalk.gray(' - I already have requirements written'));
  console.log(chalk.gray('    4. ') + chalk.cyan('DESCRIBE IN CHAT') + chalk.gray(' - Just tell the AI what you want'));
  console.log(chalk.gray('    5. ') + chalk.cyan('SHARE FILES') + chalk.gray('      - I\'ll share docs/mockups/screenshots\n'));

  let describeChoice = '';
  while (!['1', '2', '3', '4', '5'].includes(describeChoice)) {
    describeChoice = await prompt('  Enter 1-5: ');
  }

  let prdCreated = false;

  if (describeChoice === '1') {
    // Guided questions
    const answers = await runGuidedQuestions();
    const prdSpinner = ora('  Creating PRD from your answers...').start();
    writeFileSync(join(cwd, 'PRD.md'), createPrdFromAnswers(projectName, projectType, answers));
    prdSpinner.succeed('PRD created from your answers!');
    console.log(chalk.yellow('\n  → Review PRD.md, then start building with the AI\n'));
    prdCreated = true;
  } else if (describeChoice === '2') {
    // Write PRD template
    const prdSpinner = ora('  Creating PRD template...').start();
    writeFileSync(join(cwd, 'PRD.md'), createPrdTemplate(projectName, projectType));
    prdSpinner.succeed('PRD template created!');
    console.log(chalk.yellow('\n  → Open PRD.md and fill in your requirements\n'));
    prdCreated = true;
  } else if (describeChoice === '3') {
    // Paste/upload existing PRD
    console.log(chalk.cyan('\n  ━━━ Paste Your Requirements ━━━\n'));
    console.log(chalk.gray('  Paste your PRD, requirements, or spec below.'));
    console.log(chalk.gray('  When done, type ') + chalk.cyan('END') + chalk.gray(' on a new line and press Enter.\n'));

    const lines: string[] = [];
    let line = '';
    while (true) {
      line = await prompt('  ');
      if (line.toUpperCase() === 'END') break;
      lines.push(line);
    }

    if (lines.length > 0) {
      const content = lines.join('\n');
      const prdContent = `# Product Requirements Document
# Project: ${projectName}
# Created: ${new Date().toISOString().split('T')[0]}
# Type: ${projectType}
# Source: Pasted by user

${content}

---
<!-- User-provided requirements - AI reads this to build your project -->
`;
      writeFileSync(join(cwd, 'PRD.md'), prdContent);
      console.log(chalk.green('\n  ✓ Saved to PRD.md'));
      console.log(chalk.yellow('  → The AI will read this when you start building\n'));
      prdCreated = true;
    } else {
      console.log(chalk.gray('\n  No content pasted. You can add PRD.md manually later.\n'));
    }
  } else if (describeChoice === '4') {
    // Describe in chat
    console.log(chalk.gray('\n  Perfect! Just describe your project to the AI when you\'re ready.\n'));
    console.log(chalk.gray('  Example: "Build me a SaaS for invoice management with Stripe payments"\n'));
  } else {
    // Share files (option 5)
    console.log(chalk.gray('\n  Great! When chatting with the AI:\n'));
    console.log(chalk.gray('    • Drag and drop your mockups or screenshots'));
    console.log(chalk.gray('    • Share links to Figma, design files, or websites'));
    console.log(chalk.gray('    • Reference existing apps: "Make it look like Linear"\n'));
    console.log(chalk.cyan('  The AI will analyze them and start building.\n'));
  }

  // Success
  showSuccessMessage(projectName, false, prdCreated);
}

// ============================================================================
// MODE: EXISTING PROJECT
// ============================================================================

async function initExistingProject(cwd: string, projectInfo: ReturnType<typeof detectExistingProject>): Promise<void> {
  console.log(chalk.cyan('\n  ━━━ Existing Project Setup ━━━\n'));

  // Show what was detected
  console.log(chalk.gray('  Detected:'));
  for (const detail of projectInfo.details.slice(0, 5)) {
    console.log(chalk.gray(`    • ${detail}`));
  }

  const stackItems = Object.entries(projectInfo.stack).filter(([_, v]) => v);
  if (stackItems.length > 0) {
    console.log(chalk.gray('\n  Tech Stack:'));
    for (const [key, value] of stackItems) {
      console.log(chalk.gray(`    • ${key}: ${value}`));
    }
  }

  // Get project name
  const defaultName = cwd.split(/[\\/]/).pop() || 'my-project';
  const projectName = await prompt(`\n  Project name (${defaultName}): `) || defaultName;

  // Code review offer
  console.log(chalk.white('\n  Want me to review your code and bring it up to CodeBakers standards?\n'));
  console.log(chalk.gray('    1. ') + chalk.cyan('YES, REVIEW & FIX') + chalk.gray(' - Run audit, then auto-fix issues'));
  console.log(chalk.gray('    2. ') + chalk.cyan('REVIEW ONLY') + chalk.gray('      - Just show me the issues'));
  console.log(chalk.gray('    3. ') + chalk.cyan('SKIP') + chalk.gray('             - Just install CodeBakers\n'));

  let reviewChoice = '';
  while (!['1', '2', '3'].includes(reviewChoice)) {
    reviewChoice = await prompt('  Enter 1, 2, or 3: ');
  }

  let auditScore: number | undefined;

  if (reviewChoice !== '3') {
    console.log(chalk.blue('\n  Running code audit...\n'));
    const auditResult = await audit();
    auditScore = auditResult.score;

    if (auditResult.score >= 90) {
      console.log(chalk.green('\n  🎉 Your code is already in great shape!\n'));
    } else if (reviewChoice === '1') {
      const fixableCount = auditResult.checks.filter(c => !c.passed && c.severity !== 'info').length;
      if (fixableCount > 0) {
        console.log(chalk.blue('\n  🔧 Attempting to auto-fix issues...\n'));
        const healResult = await heal({ auto: true });

        if (healResult.fixed > 0) {
          console.log(chalk.green(`\n  ✓ Fixed ${healResult.fixed} issue(s)!`));
          if (healResult.remaining > 0) {
            console.log(chalk.yellow(`  ⚠ ${healResult.remaining} issue(s) need manual attention.`));
          }
        }
      }
    } else {
      console.log(chalk.gray('\n  Run `codebakers heal --auto` later to fix issues.\n'));
    }
  }

  // Login
  console.log('');
  await ensureLoggedIn();

  // Install files
  console.log(chalk.white('\n  Installing CodeBakers...\n'));
  installBootstrapFiles(cwd);

  // Create tracking files with detected stack
  const structure = buildStructureString(cwd);
  createTrackingFiles(cwd, projectName, projectInfo.stack, structure, true, auditScore);

  // Setup IDEs and MCP
  console.log('');
  setupCursorIDE(cwd);
  setupClaudeCode();

  // Update .gitignore
  updateGitignore(cwd);

  // Success
  showSuccessMessage(projectName, true);
}

// ============================================================================
// SUCCESS MESSAGE
// ============================================================================

function showSuccessMessage(projectName: string, isExisting: boolean, prdCreated?: boolean): void {
  console.log(chalk.green(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   ${chalk.bold('✓ CodeBakers Setup Complete!')}                         ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
  `));

  console.log(chalk.white('  Files created:\n'));
  console.log(chalk.cyan('    CLAUDE.md            ') + chalk.gray('→ AI bootstrap (patterns via MCP)'));
  console.log(chalk.cyan('    .cursorrules         ') + chalk.gray('→ Cursor IDE rules'));
  if (!isExisting && prdCreated) {
    console.log(chalk.cyan('    PRD.md               ') + chalk.gray('→ Product requirements'));
  }
  console.log(chalk.cyan('    PROJECT-CONTEXT.md   ') + chalk.gray('→ Codebase knowledge'));
  console.log(chalk.cyan('    PROJECT-STATE.md     ') + chalk.gray('→ Task tracking'));
  console.log(chalk.cyan('    DECISIONS.md         ') + chalk.gray('→ Architecture log'));
  console.log(chalk.cyan('    .codebakers/DEVLOG.md') + chalk.gray('→ Development log\n'));

  if (isExisting) {
    console.log(chalk.white('  What happens next:\n'));
    console.log(chalk.gray('    ✓ AI will analyze your existing code patterns'));
    console.log(chalk.gray('    ✓ AI follows your existing conventions'));
    console.log(chalk.gray('    ✓ AI updates tracking files as you work\n'));
  } else {
    console.log(chalk.white('  What happens next:\n'));
    console.log(chalk.gray('    ✓ Describe what you want to build'));
    console.log(chalk.gray('    ✓ AI fetches patterns and generates code'));
    console.log(chalk.gray('    ✓ AI updates tracking files as you work\n'));
  }

  console.log(chalk.white('  Getting started:\n'));
  console.log(chalk.gray('    For Cursor: Just open the project and start chatting'));
  console.log(chalk.gray('    For Claude Code: Run ') + chalk.cyan('codebakers install-hook') + chalk.gray(' first\n'));

  console.log(chalk.blue('  Ready to build! 🚀\n'));
}

// ============================================================================
// MAIN INIT FUNCTION
// ============================================================================

export async function init(): Promise<void> {
  console.log(chalk.blue(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   ${chalk.bold('Welcome to CodeBakers!')}                              ║
  ║                                                           ║
  ║   Production-grade patterns for AI-assisted development   ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
  `));

  const cwd = process.cwd();

  // Check if already initialized
  const claudeMdPath = join(cwd, 'CLAUDE.md');
  if (existsSync(claudeMdPath)) {
    const reinitialize = await confirm('  CLAUDE.md already exists. Reinitialize?');
    if (!reinitialize) {
      console.log(chalk.yellow('\n  Skipping. Run with a fresh project or delete CLAUDE.md first.\n'));
      return;
    }
  }

  // Detect existing project
  const projectInfo = detectExistingProject(cwd);

  if (projectInfo.exists) {
    // Existing project detected - ask what they want to do
    console.log(chalk.yellow('\n  📁 Existing project detected!\n'));
    console.log(chalk.white('  How would you like to proceed?\n'));
    console.log(chalk.gray('    1. ') + chalk.cyan('EXISTING PROJECT') + chalk.gray(' - Add CodeBakers to this codebase'));
    console.log(chalk.gray('    2. ') + chalk.cyan('NEW PROJECT') + chalk.gray('      - Start fresh (ignore existing code)\n'));

    let modeChoice = '';
    while (!['1', '2'].includes(modeChoice)) {
      modeChoice = await prompt('  Enter 1 or 2: ');
    }

    if (modeChoice === '1') {
      await initExistingProject(cwd, projectInfo);
    } else {
      await initNewProject(cwd);
    }
  } else {
    // No existing project - go straight to new project flow
    await initNewProject(cwd);
  }
}
