import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'child_process';
import { writeFileSync, existsSync, readFileSync, mkdirSync, readdirSync, statSync, rmSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import {
  getTrialState,
  setTrialState,
  getApiUrl,
  getApiKey,
  setApiKey,
  isTrialExpired,
  getTrialDaysRemaining,
  isCliAutoUpdateDisabled,
  type TrialState,
} from '../config.js';
import { validateApiKey, checkForUpdates } from '../lib/api.js';
import { getDeviceFingerprint } from '../lib/fingerprint.js';
import { audit } from './audit.js';
import { heal } from './heal.js';

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

async function confirm(question: string): Promise<boolean> {
  const answer = await prompt(`${question} (Y/n): `);
  return answer.toLowerCase() !== 'n';
}

// ============================================================================
// PROJECT DETECTION
// ============================================================================

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

interface ProjectInfo {
  exists: boolean;
  files: number;
  details: string[];
  stack: Record<string, string>;
}

function detectExistingProject(cwd: string): ProjectInfo {
  const details: string[] = [];
  const stack: Record<string, string> = {};
  let sourceFileCount = 0;

  const packageJsonPath = join(cwd, 'package.json');
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      const depCount = Object.keys(pkg.dependencies || {}).length;

      if (depCount > 0) {
        details.push(`package.json with ${depCount} dependencies`);
      }

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
// GUIDED QUESTIONS FOR NEW PROJECTS
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

  console.log(chalk.white('  1. What are you building?\n'));
  const oneLiner = await prompt('     ') || 'A web application';

  console.log(chalk.white('\n  2. What problem does this solve?\n'));
  const problem = await prompt('     ') || '';

  console.log(chalk.white('\n  3. Who will use this?\n'));
  console.log(chalk.gray('     (e.g., "small business owners", "freelancers", "developers")\n'));
  const users = await prompt('     ') || 'General users';

  console.log(chalk.white('\n  4. What are the 3 must-have features?\n'));
  console.log(chalk.gray('     (Enter each feature, then press Enter. Type "done" when finished)\n'));
  const features: string[] = [];
  for (let i = 0; i < 5; i++) {
    const feature = await prompt(`     Feature ${i + 1}: `);
    if (!feature || feature.toLowerCase() === 'done') break;
    features.push(feature);
  }

  console.log(chalk.white('\n  5. Do users need to create accounts?\n'));
  const authAnswer = await prompt('     (y/n): ');
  const auth = authAnswer.toLowerCase() === 'y' || authAnswer.toLowerCase() === 'yes';

  console.log(chalk.white('\n  6. Will you charge money?\n'));
  const paymentsAnswer = await prompt('     (y/n): ');
  const payments = paymentsAnswer.toLowerCase() === 'y' || paymentsAnswer.toLowerCase() === 'yes';

  console.log(chalk.white('\n  7. Any specific integrations needed?\n'));
  console.log(chalk.gray('     (e.g., "Stripe, SendGrid, Twilio" or press Enter to skip)\n'));
  const integrations = await prompt('     ') || '';

  console.log(chalk.white('\n  8. When do you need this done?\n'));
  console.log(chalk.gray('     (e.g., "2 weeks", "end of month", or press Enter to skip)\n'));
  const deadline = await prompt('     ') || '';

  console.log(chalk.green('\n  ✓ Got it! Creating your PRD...\n'));

  return { oneLiner, problem, users, features, auth, payments, integrations, deadline };
}

function createPrdFromAnswers(projectName: string, projectType: string, answers: GuidedAnswers): string {
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
// PROJECT FILE CREATION
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
- Configured AI assistants (Cursor + Claude Code)
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

// ============================================================================
// IDE AND MCP SETUP
// ============================================================================

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

function setupCursorIDE(cwd: string): void {
  const spinner = ora('  Setting up Cursor IDE...').start();

  try {
    // Write .cursorrules and .cursorignore
    writeFileSync(join(cwd, '.cursorrules'), CURSORRULES_TEMPLATE);
    writeFileSync(join(cwd, '.cursorignore'), CURSORIGNORE_TEMPLATE);

    // Global MCP config for Cursor
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
      try {
        const existing = JSON.parse(readFileSync(settingsPath, 'utf-8'));
        writeFileSync(settingsPath, JSON.stringify({ ...existing, ...VSCODE_SETTINGS_TEMPLATE }, null, 2));
      } catch {
        writeFileSync(settingsPath, JSON.stringify(VSCODE_SETTINGS_TEMPLATE, null, 2));
      }
    } else {
      writeFileSync(settingsPath, JSON.stringify(VSCODE_SETTINGS_TEMPLATE, null, 2));
    }

    spinner.succeed('Cursor IDE configured!');
  } catch {
    spinner.warn('Could not configure Cursor IDE (continuing anyway)');
  }
}

function setupClaudeCodeMCP(cwd: string): void {
  const spinner = ora('  Setting up Claude Code MCP...').start();

  try {
    const isWindows = process.platform === 'win32';

    // Create project-level .mcp.json (Claude Code reads this automatically)
    const mcpConfig = {
      mcpServers: {
        codebakers: isWindows
          ? { command: 'cmd', args: ['/c', 'npx', '-y', '@codebakers/cli', 'serve'] }
          : { command: 'npx', args: ['-y', '@codebakers/cli', 'serve'] }
      }
    };

    const mcpJsonPath = join(cwd, '.mcp.json');

    if (existsSync(mcpJsonPath)) {
      try {
        const existing = JSON.parse(readFileSync(mcpJsonPath, 'utf-8'));
        if (!existing.mcpServers) {
          existing.mcpServers = {};
        }
        existing.mcpServers.codebakers = mcpConfig.mcpServers.codebakers;
        writeFileSync(mcpJsonPath, JSON.stringify(existing, null, 2));
      } catch {
        writeFileSync(mcpJsonPath, JSON.stringify(mcpConfig, null, 2));
      }
    } else {
      writeFileSync(mcpJsonPath, JSON.stringify(mcpConfig, null, 2));
    }

    spinner.succeed('Claude Code MCP configured (.mcp.json created)');
  } catch {
    spinner.warn('Could not configure Claude Code MCP (continuing anyway)');
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

    // Remove old .claude folder if it exists
    const claudeDir = join(cwd, '.claude');
    if (existsSync(claudeDir)) {
      try {
        rmSync(claudeDir, { recursive: true, force: true });
      } catch {
        // Ignore errors
      }
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
  } catch {
    spinner.warn('Some tracking files could not be created');
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

interface GoOptions {
  verbose?: boolean;
  // Non-interactive flags for programmatic use (e.g., by AI assistants)
  type?: 'personal' | 'client' | 'business';
  name?: string;
  describe?: 'guided' | 'template' | 'paste' | 'chat' | 'files';
  skipReview?: boolean;
}

// ============================================================================
// SMART CONTEXT DETECTION - "Where am I? What's next?"
// ============================================================================

interface ProjectState {
  isSetUp: boolean;
  projectName?: string;
  projectType?: string;
  hasPrd: boolean;
  prdSummary?: string;
  inProgressTasks: string[];
  completedTasks: string[];
  blockers: string[];
  lastSession?: string;
  suggestion: string;
}

function analyzeProjectState(cwd: string): ProjectState {
  const state: ProjectState = {
    isSetUp: false,
    hasPrd: false,
    inProgressTasks: [],
    completedTasks: [],
    blockers: [],
    suggestion: '',
  };

  // Check if CodeBakers is set up
  const codebakersJsonPath = join(cwd, '.codebakers.json');
  if (!existsSync(codebakersJsonPath)) {
    state.suggestion = 'Project not set up. Running first-time setup...';
    return state;
  }

  state.isSetUp = true;

  // Read .codebakers.json
  try {
    const cbState = JSON.parse(readFileSync(codebakersJsonPath, 'utf-8'));
    state.projectName = cbState.projectName;
    state.projectType = cbState.projectType;
  } catch {
    // Ignore parse errors
  }

  // Check for PRD.md
  const prdPath = join(cwd, 'PRD.md');
  if (existsSync(prdPath)) {
    state.hasPrd = true;
    try {
      const prdContent = readFileSync(prdPath, 'utf-8');
      // Extract one-liner if present
      const oneLineMatch = prdContent.match(/\*\*One-liner:\*\*\s*(.+)/);
      if (oneLineMatch) {
        state.prdSummary = oneLineMatch[1].trim();
      } else {
        // Get first non-comment, non-header line
        const lines = prdContent.split('\n').filter(l =>
          l.trim() && !l.startsWith('#') && !l.startsWith('<!--')
        );
        if (lines[0]) {
          state.prdSummary = lines[0].substring(0, 100);
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  // Read PROJECT-STATE.md for tasks
  const projectStatePath = join(cwd, 'PROJECT-STATE.md');
  if (existsSync(projectStatePath)) {
    try {
      const content = readFileSync(projectStatePath, 'utf-8');

      // Extract In Progress section
      const inProgressMatch = content.match(/## In Progress\n([\s\S]*?)(?=\n##|$)/);
      if (inProgressMatch) {
        const lines = inProgressMatch[1].split('\n')
          .filter(l => l.trim().startsWith('-'))
          .map(l => l.replace(/^-\s*/, '').trim())
          .filter(l => l && !l.startsWith('<!--'));
        state.inProgressTasks = lines;
      }

      // Extract Completed section (last 5)
      const completedMatch = content.match(/## Completed\n([\s\S]*?)(?=\n##|$)/);
      if (completedMatch) {
        const lines = completedMatch[1].split('\n')
          .filter(l => l.trim().startsWith('-'))
          .map(l => l.replace(/^-\s*/, '').trim())
          .filter(l => l && !l.startsWith('<!--'));
        state.completedTasks = lines.slice(-5);
      }

      // Extract Blockers section
      const blockersMatch = content.match(/## Blockers\n([\s\S]*?)(?=\n##|$)/);
      if (blockersMatch) {
        const lines = blockersMatch[1].split('\n')
          .filter(l => l.trim().startsWith('-'))
          .map(l => l.replace(/^-\s*/, '').trim())
          .filter(l => l && !l.startsWith('<!--'));
        state.blockers = lines;
      }
    } catch {
      // Ignore read errors
    }
  }

  // Read DEVLOG for last session
  const devlogPath = join(cwd, '.codebakers', 'DEVLOG.md');
  if (existsSync(devlogPath)) {
    try {
      const content = readFileSync(devlogPath, 'utf-8');
      // Get first session entry
      const sessionMatch = content.match(/## .+?\n\*\*Session:\*\*\s*(.+)/);
      if (sessionMatch) {
        state.lastSession = sessionMatch[1].trim();
      }
      // Get "What was done" from most recent entry
      const whatDoneMatch = content.match(/### What was done:\n([\s\S]*?)(?=\n###|---|\n\n)/);
      if (whatDoneMatch && !state.lastSession) {
        const lines = whatDoneMatch[1].split('\n')
          .filter(l => l.trim().startsWith('-'))
          .map(l => l.replace(/^-\s*/, '').trim());
        if (lines[0]) {
          state.lastSession = lines[0];
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  // Determine suggestion based on state
  if (state.blockers.length > 0) {
    state.suggestion = `BLOCKED: ${state.blockers[0]}. Address this blocker first.`;
  } else if (state.inProgressTasks.length > 0) {
    state.suggestion = `CONTINUE: ${state.inProgressTasks[0]}`;
  } else if (state.hasPrd && state.completedTasks.length === 0) {
    state.suggestion = `START BUILDING: PRD exists. Begin implementing features from PRD.md`;
  } else if (!state.hasPrd) {
    state.suggestion = `DEFINE PROJECT: No PRD found. Describe what you want to build.`;
  } else {
    state.suggestion = `READY: Project set up. Ask for the next feature to build.`;
  }

  return state;
}

function showResumeContext(state: ProjectState): void {
  console.log(chalk.blue(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   ${chalk.bold.white('CodeBakers - Resuming Session')}                          ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
  `));

  console.log(chalk.white(`  📁 Project: ${chalk.cyan(state.projectName || 'Unknown')}`));

  if (state.prdSummary) {
    console.log(chalk.gray(`  📝 ${state.prdSummary}`));
  }

  console.log('');

  // Show blockers first (critical)
  if (state.blockers.length > 0) {
    console.log(chalk.red('  ⚠️  BLOCKERS:'));
    for (const blocker of state.blockers) {
      console.log(chalk.red(`      • ${blocker}`));
    }
    console.log('');
  }

  // Show in-progress tasks
  if (state.inProgressTasks.length > 0) {
    console.log(chalk.yellow('  🔄 IN PROGRESS:'));
    for (const task of state.inProgressTasks) {
      console.log(chalk.yellow(`      • ${task}`));
    }
    console.log('');
  }

  // Show recent completed (context)
  if (state.completedTasks.length > 0) {
    console.log(chalk.green('  ✓ RECENTLY COMPLETED:'));
    for (const task of state.completedTasks.slice(-3)) {
      console.log(chalk.gray(`      • ${task}`));
    }
    console.log('');
  }

  // Show last session timestamp if available
  if (state.lastSession) {
    console.log(chalk.gray(`  📅 Last session: ${state.lastSession}`));
    console.log('');
  }

  // Show the suggestion prominently
  console.log(chalk.cyan('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.white.bold(`\n  → ${state.suggestion}\n`));
  console.log(chalk.cyan('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  // Output machine-readable context for AI
  console.log(chalk.gray('  [AI Context]'));
  console.log(chalk.gray(`  Project: ${state.projectName || 'Unknown'}`));
  console.log(chalk.gray(`  Status: ${state.inProgressTasks.length > 0 ? 'IN_PROGRESS' : state.blockers.length > 0 ? 'BLOCKED' : 'READY'}`));
  console.log(chalk.gray(`  Next Action: ${state.suggestion}`));
  if (state.hasPrd) {
    console.log(chalk.gray(`  PRD: Available at PRD.md`));
  }
  console.log('');
}

interface ConfirmData {
  version: string;
  moduleCount: number;
  cliVersion?: string;
  command: string;
  projectName?: string;
}

interface AuthInfo {
  apiKey?: string;
  trialId?: string;
}

/**
 * Get CLI version from package.json
 */
function getCliVersion(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('../../package.json');
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * Confirm download to server (non-blocking, fire-and-forget)
 */
async function confirmDownload(apiUrl: string, auth: AuthInfo, data: ConfirmData): Promise<void> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (auth.apiKey) {
      headers['Authorization'] = `Bearer ${auth.apiKey}`;
    }
    if (auth.trialId) {
      headers['X-Trial-ID'] = auth.trialId;
    }

    await fetch(`${apiUrl}/api/content/confirm`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
  } catch {
    // Silently ignore - this is just for analytics
  }
}

function log(message: string, options?: GoOptions): void {
  if (options?.verbose) {
    console.log(chalk.gray(`  [verbose] ${message}`));
  }
}

// Current CLI version - must match package.json
const CURRENT_VERSION = '3.9.10';

/**
 * Check for updates and install them automatically
 * This makes "codebakers go" the magic phrase that keeps everything updated
 */
async function checkAndInstallUpdates(options: GoOptions = {}): Promise<void> {
  // Skip if auto-update is disabled
  if (isCliAutoUpdateDisabled()) {
    log('Auto-update disabled, skipping...', options);
    return;
  }

  try {
    log('Checking for CLI updates...', options);
    const updateInfo = await checkForUpdates();

    if (!updateInfo || !updateInfo.updateAvailable) {
      log('CLI is up to date', options);
      return;
    }

    // Show blocked version warning
    if (updateInfo.isBlocked) {
      console.log(chalk.red(`
  ⚠️  Your CLI version (${CURRENT_VERSION}) has critical issues.
  Updating to ${updateInfo.latestVersion}...
      `));
    }

    const targetVersion = updateInfo.latestVersion;

    // Only auto-update if server says it's safe
    if (!updateInfo.autoUpdateEnabled && !updateInfo.isBlocked) {
      // Just show banner, don't auto-install
      console.log(chalk.yellow(`
  📦 Update available: ${CURRENT_VERSION} → ${chalk.green(targetVersion)}
     Run: npm i -g @codebakers/cli@latest
      `));
      return;
    }

    // Auto-install the update
    console.log(chalk.blue(`\n  🔄 Updating CLI: ${CURRENT_VERSION} → ${chalk.green(targetVersion)}...\n`));

    try {
      execSync('npm install -g @codebakers/cli@latest', {
        stdio: 'inherit',
        timeout: 60000,
      });

      console.log(chalk.green(`\n  ✓ CLI updated to v${targetVersion}!\n`));
      console.log(chalk.gray('  Restart your terminal or run `codebakers go` again.\n'));

      // Exit so user gets the new version
      process.exit(0);

    } catch (installError) {
      const errorMessage = installError instanceof Error ? installError.message : String(installError);

      if (errorMessage.includes('EACCES') || errorMessage.includes('permission')) {
        console.log(chalk.yellow(`
  ⚠️  Update failed (permission denied)

  Run manually: ${chalk.cyan('sudo npm i -g @codebakers/cli@latest')}
        `));
      } else {
        console.log(chalk.yellow(`
  ⚠️  Update failed

  Run manually: ${chalk.cyan('npm i -g @codebakers/cli@latest')}
        `));
      }
      // Continue anyway - don't block the user
    }
  } catch (error) {
    // Silently fail - don't block CLI for update check
    log(`Update check failed: ${error}`, options);
  }
}

/**
 * Zero-friction entry point - start using CodeBakers instantly
 * Single command for both trial and paid users
 *
 * SMART BEHAVIOR:
 * - If CodeBakers already set up → Show context and resume from where you left off
 * - If not set up → Run first-time setup (trial or login)
 */
export async function go(options: GoOptions = {}): Promise<void> {
  log('Starting go command...', options);
  log(`API URL: ${getApiUrl()}`, options);
  log(`Working directory: ${process.cwd()}`, options);

  // =========================================================================
  // AUTO-UPDATE CHECK - The magic of "codebakers go"
  // =========================================================================
  await checkAndInstallUpdates(options);

  const cwd = process.cwd();

  // =========================================================================
  // SMART CONTEXT CHECK - If already set up, show resume context
  // =========================================================================
  const projectState = analyzeProjectState(cwd);

  if (projectState.isSetUp) {
    // Project already has CodeBakers - show context and resume
    showResumeContext(projectState);

    // CRITICAL: Ensure .mcp.json exists for Claude Code MCP tools
    // This fixes the issue where existing projects set up before v3.9.14
    // never got .mcp.json created (it was only created in first-time setup)
    const mcpJsonPath = join(cwd, '.mcp.json');
    if (!existsSync(mcpJsonPath)) {
      console.log(chalk.yellow('  ⚠️  MCP config missing - creating .mcp.json...\n'));
      setupClaudeCodeMCP(cwd);
      console.log(chalk.yellow('  ⚠️  RELOAD REQUIRED to load MCP tools\n'));
      console.log(chalk.white('  Claude Code needs to reload to detect the new .mcp.json file.\n'));
      console.log(chalk.cyan('  To reload:\n'));
      console.log(chalk.gray('    VS Code: ') + chalk.white('Press ') + chalk.cyan('Cmd/Ctrl+Shift+P') + chalk.white(' → type ') + chalk.cyan('"Reload Window"'));
      console.log(chalk.gray('    CLI:     ') + chalk.white('Press ') + chalk.cyan('Ctrl+C') + chalk.white(' and run ') + chalk.cyan('claude') + chalk.white(' again\n'));
    }

    // Verify auth is still valid
    const existingApiKey = getApiKey();
    const existingTrial = getTrialState();

    if (existingApiKey) {
      console.log(chalk.green('  ✓ Authenticated with API key\n'));
      console.log(chalk.gray('  You\'re all set! Ask Claude to help you build something.\n'));
    } else if (existingTrial && !isTrialExpired()) {
      const daysRemaining = getTrialDaysRemaining();
      console.log(chalk.green(`  ✓ Trial active - ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining\n`));
      console.log(chalk.gray('  You\'re all set! Ask Claude to help you build something.\n'));
    } else if (existingTrial && isTrialExpired()) {
      console.log(chalk.yellow('  ⚠️  Trial expired\n'));
      console.log(chalk.white('  To continue using CodeBakers:'));
      console.log(chalk.cyan('    codebakers extend') + chalk.gray(' - Get 7 more days (free)'));
      console.log(chalk.cyan('    codebakers go') + chalk.gray('     - Login with API key\n'));
    } else {
      console.log(chalk.yellow('  ⚠️  No active session\n'));
      console.log(chalk.white('  To activate CodeBakers:'));
      console.log(chalk.cyan('    codebakers go\n'));
    }

    // Don't run setup again - just show context
    return;
  }

  // =========================================================================
  // FIRST-TIME SETUP - Project not yet configured
  // =========================================================================

  // Auto-detect non-interactive mode (e.g., running from Claude Code)
  const isNonInteractive = !process.stdin.isTTY;
  if (isNonInteractive) {
    console.log(chalk.blue('\n  ───────────────────────────────────────────────────────'));
    console.log(chalk.blue('  CodeBakers - Non-Interactive Setup'));
    console.log(chalk.blue('  ───────────────────────────────────────────────────────\n'));

    console.log(chalk.gray('  Running from Claude Code - installing project files...\n'));

    // Just set up the project files without auth
    // Auth can be done later via `codebakers go` in terminal or via MCP tools
    await setupProject(options);

    console.log(chalk.green('\n  ✅ Project files installed successfully!\n'));
    console.log(chalk.white('  What was set up:'));
    console.log(chalk.gray('    • CLAUDE.md - AI instructions for this project'));
    console.log(chalk.gray('    • .codebakers.json - Project configuration'));
    console.log(chalk.gray('    • .mcp.json - MCP server configuration for Claude Code\n'));

    console.log(chalk.yellow('  ⚠️  RELOAD REQUIRED to load MCP tools\n'));
    console.log(chalk.white('  Claude Code needs to reload to detect the new .mcp.json file.\n'));
    console.log(chalk.cyan('  To reload:\n'));
    console.log(chalk.gray('    VS Code: ') + chalk.white('Press ') + chalk.cyan('Cmd/Ctrl+Shift+P') + chalk.white(' → type ') + chalk.cyan('"Reload Window"'));
    console.log(chalk.gray('    CLI:     ') + chalk.white('Press ') + chalk.cyan('Ctrl+C') + chalk.white(' and run ') + chalk.cyan('claude') + chalk.white(' again\n'));
    console.log(chalk.white('  After reload, MCP tools (discover_patterns, validate_complete)'));
    console.log(chalk.white('  will be available automatically.\n'));
    console.log(chalk.gray('  ─────────────────────────────────────────────────────────\n'));
    console.log(chalk.gray('  Optional: To activate trial, run ') + chalk.cyan('codebakers go') + chalk.gray(' in a terminal.\n'));
    return;
  }

  console.log(chalk.blue(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   ${chalk.bold.white('CodeBakers - Get Started')}                             ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
  `));

  // Check if user already has an API key (paid user)
  log('Checking for existing API key...', options);
  const existingApiKey = getApiKey();
  if (existingApiKey) {
    log(`Found API key: ${existingApiKey.substring(0, 8)}...`, options);
    console.log(chalk.green('  ✓ You\'re already logged in!\n'));

    // Run complete project setup
    await setupProject(options, { apiKey: existingApiKey });
    await showSuccessAndRestart();
    return;
  }
  log('No API key found, checking trial state...', options);

  // Check existing trial
  const existingTrial = getTrialState();

  if (existingTrial && !isTrialExpired()) {
    const daysRemaining = getTrialDaysRemaining();
    console.log(chalk.green(`  ✓ Trial active (${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining)\n`));

    if (existingTrial.stage === 'anonymous' && daysRemaining <= 2) {
      console.log(chalk.yellow('  ⚠️  Trial expiring soon! Extend with GitHub:\n'));
      console.log(chalk.cyan('    codebakers extend\n'));
    }

    // Run complete project setup
    await setupProject(options, { trialId: existingTrial.trialId });
    await showSuccessAndRestart();
    return;
  }

  // Check if trial expired
  if (existingTrial && isTrialExpired()) {
    console.log(chalk.yellow(`
  ╭───────────────────────────────────────────────────────────╮
  │  ⚠️  Your 7-day trial has expired                         │
  ╰───────────────────────────────────────────────────────────╯
    `));

    console.log(chalk.white('  You can still use CodeBakers! Choose an option:\n'));
    console.log(chalk.cyan('  [1] Login with API key'));
    console.log(chalk.gray('      If you purchased a subscription at codebakers.ai\n'));
    console.log(chalk.cyan('  [2] Extend trial (+7 days)'));
    console.log(chalk.gray('      Connect your GitHub account for more time\n'));

    const choice = await prompt(chalk.gray('  Enter 1 or 2: '));

    if (choice === '1') {
      await handleApiKeyLogin(options);
      return;
    } else {
      console.log(chalk.white('\n  To extend your trial, run:\n'));
      console.log(chalk.cyan('    codebakers extend\n'));
      console.log(chalk.gray('  This will open GitHub for authentication.\n'));
      return;
    }
  }

  // New user - ask how they want to proceed
  console.log(chalk.white('  How would you like to get started?\n'));
  console.log(chalk.cyan('  [1] Start free 7-day trial'));
  console.log(chalk.gray('      No credit card needed - just GitHub login\n'));
  console.log(chalk.cyan('  [2] Login with API key'));
  console.log(chalk.gray('      I already have a CodeBakers account\n'));

  const choice = await prompt(chalk.gray('  Enter 1 or 2: '));

  if (choice === '2') {
    await handleApiKeyLogin(options);
    return;
  }

  // Start new trial via GitHub OAuth
  await startTrialWithGitHub(options);
}

/**
 * Open a URL in the default browser
 */
function openBrowser(url: string): void {
  const platform = process.platform;

  try {
    if (platform === 'win32') {
      execSync(`start "" "${url}"`, { stdio: 'ignore', shell: 'cmd.exe' });
    } else if (platform === 'darwin') {
      execSync(`open "${url}"`, { stdio: 'ignore' });
    } else {
      // Linux - try common browsers
      execSync(`xdg-open "${url}" || sensible-browser "${url}" || x-www-browser "${url}"`, {
        stdio: 'ignore',
        shell: '/bin/sh',
      });
    }
  } catch {
    console.log(chalk.yellow(`\n  Could not open browser automatically.`));
    console.log(chalk.gray(`  Please open this URL manually:\n`));
    console.log(chalk.cyan(`  ${url}\n`));
  }
}

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Start a new trial via GitHub OAuth
 * This ensures one trial per GitHub account
 */
async function startTrialWithGitHub(options: GoOptions = {}): Promise<void> {
  const fingerprint = getDeviceFingerprint();
  const apiUrl = getApiUrl();
  const authUrl = `${apiUrl}/api/auth/github/trial?device_hash=${fingerprint.deviceHash}`;

  console.log(chalk.white('\n  Opening browser for GitHub authorization...\n'));
  console.log(chalk.gray('  This links your trial to your GitHub account to prevent abuse.\n'));

  openBrowser(authUrl);

  console.log(chalk.gray('  Waiting for authorization...'));
  console.log(chalk.gray('  (This may take a moment)\n'));

  // Poll for trial creation
  const spinner = ora('Checking authorization status...').start();
  let trialCreated = false;
  let pollCount = 0;
  const maxPolls = 60; // 2 minutes max

  while (pollCount < maxPolls && !trialCreated) {
    await sleep(2000);
    pollCount++;

    try {
      const response = await fetch(`${apiUrl}/api/trial/status?deviceHash=${fingerprint.deviceHash}`);
      const data = await response.json();

      if (response.ok && data.trialId) {
        trialCreated = true;

        // Save trial state
        const trialState: TrialState = {
          trialId: data.trialId,
          stage: data.stage,
          deviceHash: fingerprint.deviceHash,
          expiresAt: data.expiresAt,
          startedAt: data.startedAt,
          ...(data.githubUsername && { githubUsername: data.githubUsername }),
          ...(data.projectId && { projectId: data.projectId }),
          ...(data.projectName && { projectName: data.projectName }),
        };

        setTrialState(trialState);

        const username = data.githubUsername ? ` Welcome, @${data.githubUsername}!` : '';
        spinner.succeed(`Trial started (${data.daysRemaining} days free)${username}`);
        console.log('');

        // Run complete project setup
        await setupProject(options, { trialId: data.trialId });
        await showSuccessAndRestart();
        return;
      }
    } catch {
      // Ignore polling errors - continue waiting
      log(`Poll ${pollCount} failed, retrying...`, options);
    }
  }

  if (!trialCreated) {
    spinner.warn('Authorization timed out');
    console.log(chalk.yellow('\n  Please try again or authorize manually:\n'));
    console.log(chalk.cyan(`  ${authUrl}\n`));
  }
}

/**
 * Handle API key login flow (for paid users)
 */
async function handleApiKeyLogin(options: GoOptions = {}): Promise<void> {
  console.log(chalk.white('\n  Enter your API key\n'));
  console.log(chalk.gray('  Find it at: https://codebakers.ai/dashboard\n'));

  const apiKey = await prompt(chalk.cyan('  API Key: '));

  if (!apiKey) {
    console.log(chalk.red('\n  API key is required.\n'));
    return;
  }

  const spinner = ora('Validating API key...').start();

  try {
    await validateApiKey(apiKey);
    spinner.succeed('API key validated');

    // Save API key
    setApiKey(apiKey);
    console.log(chalk.green('  ✓ Logged in successfully!\n'));

    // Run complete project setup
    await setupProject(options, { apiKey });
    await showSuccessAndRestart();

  } catch (error) {
    spinner.fail('Invalid API key');
    console.log(chalk.red('\n  Could not validate API key.'));
    console.log(chalk.gray('  Check your key at: https://codebakers.ai/dashboard\n'));
  }
}

/**
 * Show success message with clear next steps based on user's editor
 */
async function showSuccessAndRestart(): Promise<void> {
  console.log(chalk.green(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   ✅  CodeBakers Setup Complete!                          ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
  `));

  // Check if we're in non-interactive mode
  const isNonInteractive = !process.stdin.isTTY;

  if (isNonInteractive) {
    // Non-interactive mode - show generic instructions
    console.log(chalk.yellow('  ⚠️  RELOAD REQUIRED\n'));
    console.log(chalk.white('  Your editor needs to reload to activate CodeBakers.\n'));
    console.log(chalk.cyan('  For Cursor:'));
    console.log(chalk.gray('    Press ') + chalk.cyan('Cmd/Ctrl+Shift+P') + chalk.gray(' → type ') + chalk.cyan('"Reload Window"') + chalk.gray(' → press Enter\n'));
    console.log(chalk.cyan('  For VS Code with Claude Code:'));
    console.log(chalk.gray('    Press ') + chalk.cyan('Cmd/Ctrl+Shift+P') + chalk.gray(' → type ') + chalk.cyan('"Reload Window"') + chalk.gray(' → press Enter\n'));
    console.log(chalk.gray('  ─────────────────────────────────────────────────────────\n'));
    console.log(chalk.gray('  Having issues? Run: ') + chalk.cyan('codebakers doctor') + chalk.gray(' to diagnose\n'));
    return;
  }

  // Interactive mode - ask which editor they're using
  console.log(chalk.white('  Which editor are you using?\n'));
  console.log(chalk.gray('    1. ') + chalk.cyan('Cursor') + chalk.gray('                - AI code editor'));
  console.log(chalk.gray('    2. ') + chalk.cyan('VS Code + Claude Code') + chalk.gray(' - VS Code with Claude extension\n'));

  let editorChoice = '';
  while (!['1', '2'].includes(editorChoice)) {
    editorChoice = await prompt('  Enter 1 or 2: ');
  }

  console.log('');

  if (editorChoice === '1') {
    // Cursor instructions
    await showCursorInstructions();
  } else {
    // VS Code + Claude Code instructions
    await showVSCodeClaudeInstructions();
  }
}

/**
 * Show Cursor-specific instructions
 */
async function showCursorInstructions(): Promise<void> {
  console.log(chalk.cyan('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.white.bold('\n  🎯 CURSOR SETUP - Follow these steps:\n'));
  console.log(chalk.cyan('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  console.log(chalk.yellow('  STEP 1: Reload Cursor to activate CodeBakers\n'));
  console.log(chalk.gray('    Press ') + chalk.cyan('Cmd+Shift+P') + chalk.gray(' (Mac) or ') + chalk.cyan('Ctrl+Shift+P') + chalk.gray(' (Windows)'));
  console.log(chalk.gray('    Type ') + chalk.cyan('"Reload Window"') + chalk.gray(' and press Enter\n'));

  console.log(chalk.yellow('  STEP 2: Open the AI Chat\n'));
  console.log(chalk.gray('    Press ') + chalk.cyan('Cmd+L') + chalk.gray(' (Mac) or ') + chalk.cyan('Ctrl+L') + chalk.gray(' (Windows)'));
  console.log(chalk.gray('    This opens the Cursor Chat panel on the right side\n'));

  console.log(chalk.yellow('  STEP 3: Start building!\n'));
  console.log(chalk.gray('    Type your request in the chat. For example:\n'));
  console.log(chalk.white('      "Build me a todo app with authentication"'));
  console.log(chalk.white('      "Add a login page to my project"'));
  console.log(chalk.white('      "Review my code and make it production-ready"\n'));

  console.log(chalk.green('  ✅ You are now done with the terminal!\n'));
  console.log(chalk.gray('     From now on, use the ') + chalk.cyan('Cursor Chat') + chalk.gray(' to talk to AI.'));
  console.log(chalk.gray('     The terminal is only needed for running commands like npm.\n'));

  console.log(chalk.gray('  ─────────────────────────────────────────────────────────\n'));
  console.log(chalk.gray('  Having issues? Run: ') + chalk.cyan('codebakers doctor') + chalk.gray(' to diagnose\n'));
}

/**
 * Show VS Code + Claude Code specific instructions
 */
async function showVSCodeClaudeInstructions(): Promise<void> {
  console.log(chalk.cyan('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.white.bold('\n  🎯 VS CODE + CLAUDE CODE SETUP - Follow these steps:\n'));
  console.log(chalk.cyan('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  console.log(chalk.yellow('  STEP 1: Reload VS Code to activate CodeBakers\n'));
  console.log(chalk.gray('    Press ') + chalk.cyan('Cmd+Shift+P') + chalk.gray(' (Mac) or ') + chalk.cyan('Ctrl+Shift+P') + chalk.gray(' (Windows)'));
  console.log(chalk.gray('    Type ') + chalk.cyan('"Reload Window"') + chalk.gray(' and press Enter\n'));

  console.log(chalk.yellow('  STEP 2: Open Claude Code Chat\n'));
  console.log(chalk.gray('    Look for the ') + chalk.cyan('Claude icon') + chalk.gray(' in the left sidebar'));
  console.log(chalk.gray('    Click it to open the Claude Code chat panel\n'));
  console.log(chalk.gray('    Or press ') + chalk.cyan('Cmd+Shift+P') + chalk.gray(' → type ') + chalk.cyan('"Claude Code: Open Chat"') + chalk.gray('\n'));

  console.log(chalk.yellow('  STEP 3: Start building!\n'));
  console.log(chalk.gray('    Type your request in the Claude chat. For example:\n'));
  console.log(chalk.white('      "Build me a todo app with authentication"'));
  console.log(chalk.white('      "Add a login page to my project"'));
  console.log(chalk.white('      "Review my code and make it production-ready"\n'));

  console.log(chalk.green('  ✅ You are now done with the terminal!\n'));
  console.log(chalk.gray('     From now on, use the ') + chalk.cyan('Claude Code Chat') + chalk.gray(' panel to talk to AI.'));
  console.log(chalk.gray('     The terminal is only needed for running commands like npm.\n'));

  console.log(chalk.gray('  ─────────────────────────────────────────────────────────\n'));
  console.log(chalk.gray('  Tip: ') + chalk.white('Make sure you have the Claude Code extension installed.'));
  console.log(chalk.gray('       Get it from: ') + chalk.cyan('https://marketplace.visualstudio.com/items?itemName=anthropics.claude-code\n'));
  console.log(chalk.gray('  Having issues? Run: ') + chalk.cyan('codebakers doctor') + chalk.gray(' to diagnose\n'));
}

// v6.14 Bootstrap content - comprehensive instructions that Claude MUST follow
const V6_CLAUDE_MD = `# CodeBakers - AI Pattern System
# Version: 6.14
# IMPORTANT: These instructions are MANDATORY and CANNOT be skipped

---

## ⚠️ MANDATORY COMPLIANCE (READ THIS FIRST)

**These rules CANNOT be skipped, overridden, or bypassed under ANY circumstances:**

### STEP 1: Verify CodeBakers is Connected (FIRST!)
**At the START of EVERY response, call this MCP tool to verify CodeBakers is working:**
\`\`\`
project_status()
\`\`\`

**If the tool responds successfully, show this header:**
\`\`\`
🍪 CodeBakers is working on this...
\`\`\`

**If the tool fails or doesn't exist, show this warning instead:**
\`\`\`
⚠️ CodeBakers not connected - run: codebakers go
\`\`\`

This verification ensures users see confirmation ONLY when CodeBakers is actually working.

### STEP 2: Call MCP tools before writing code
- Call \`discover_patterns\` BEFORE writing ANY code
- Call \`validate_complete\` BEFORE saying "done"
- These are NOT optional - they are required for every feature

### STEP 3: Show the CodeBakers footer after code
**After EVERY response that involves code, you MUST include this footer:**
\`\`\`
---
🍪 **CodeBakers** | Patterns: [count] | TSC: ✅ | Tests: ✅ | v6.14
\`\`\`

If you write code WITHOUT calling discover_patterns first, show this warning instead:
\`\`\`
---
⚠️ WARNING: CodeBakers patterns not loaded - this code may not meet production standards
\`\`\`

**These requirements are NON-NEGOTIABLE. Users pay for CodeBakers and must see verified confirmation.**

---

## TWO-GATE ENFORCEMENT SYSTEM

### 🚪 GATE 1: BEFORE WRITING CODE → \`discover_patterns\`

You MUST call this MCP tool before writing any code:
\`\`\`
discover_patterns({ task: "what you're about to do", keywords: ["relevant", "keywords"] })
\`\`\`

This tool:
- Searches for patterns relevant to your task
- Returns code examples you MUST follow
- Creates a session token for validation

**You are NOT ALLOWED to write code without calling this first.**

### 🚪 GATE 2: BEFORE SAYING "DONE" → \`validate_complete\`

You MUST call this MCP tool before completing any feature:
\`\`\`
validate_complete({ feature: "feature name", files: ["path/to/file.ts"] })
\`\`\`

This tool checks:
- discover_patterns was called (compliance tracking)
- Tests exist for the feature
- TypeScript compiles
- Code follows patterns

**You are NOT ALLOWED to say "done" without calling this.**

---

## WORKFLOW FOR EVERY FEATURE

1. User asks for a feature
2. **CALL discover_patterns** → Get patterns to follow
3. Read and follow the patterns returned
4. Write code following the patterns exactly
5. Write tests for the feature
6. **CALL validate_complete** → Verify everything passes
7. Show the CodeBakers footer
8. ONLY THEN say "done"

---

## HARD RULES (Enforced)

1. **NO writing code without \`discover_patterns\`** - Always call it first
2. **NO "want me to add tests?"** - Just add them. Tests are required.
3. **NO "I'll add tests later"** - Tests are part of the feature.
4. **NO saying "done" without \`validate_complete\`** - Must pass validation
5. **NO skipping the footer** - Always show CodeBakers Active
6. **NO ignoring patterns** - Follow what discover_patterns returns

---

## IF MCP SERVER IS UNAVAILABLE

If the CodeBakers MCP tools aren't available:
1. Show a warning to the user: "CodeBakers MCP server not connected"
2. Suggest running: \`codebakers doctor\` to diagnose
3. Still write quality code following best practices
4. Show the warning footer instead of the active footer

---

## GETTING HELP

- Run \`codebakers doctor\` to diagnose connection issues
- Run \`codebakers upgrade\` to update patterns
- Visit https://codebakers.ai/support for help

---
*CodeBakers v6.14 - Production patterns for AI-assisted development*
`;

const V6_CURSORRULES = `# CodeBakers - AI Pattern System (Cursor Rules)
# IMPORTANT: These instructions are MANDATORY

## ⚠️ MANDATORY COMPLIANCE

### You MUST call MCP tools before writing code
- Call discover_patterns BEFORE writing ANY code
- Call validate_complete BEFORE saying "done"

### You MUST show the CodeBakers footer after every code response
After EVERY response with code, include:
---
🍪 **CodeBakers Active** | Patterns loaded | v6.14

If patterns not loaded, show warning instead:
---
⚠️ WARNING: CodeBakers patterns not loaded

## WORKFLOW

1. User asks for feature
2. CALL discover_patterns → Get patterns
3. Write code following patterns exactly
4. Write tests
5. CALL validate_complete → Verify
6. Show footer
7. Say "done"

## HARD RULES

1. NO writing code without discover_patterns
2. NO skipping tests - just add them
3. NO saying "done" without validate_complete
4. NO skipping the footer

## MCP TOOLS

### discover_patterns (BEFORE writing code)
discover_patterns({ task: "description", keywords: ["terms"] })

### validate_complete (BEFORE saying done)
validate_complete({ feature: "name", files: ["paths"] })

---
CodeBakers v6.14
`;

/**
 * Complete project setup - handles everything:
 * - Detect new vs existing project
 * - Set up all tracking files
 * - Configure Cursor and Claude Code MCP
 * - Run guided questions for new projects
 * - Run code review for existing projects
 */
async function setupProject(options: GoOptions = {}, auth?: AuthInfo): Promise<void> {
  const cwd = process.cwd();

  // Detect if this is an existing project
  const projectInfo = detectExistingProject(cwd);

  if (projectInfo.exists) {
    // Existing project detected
    await setupExistingProject(cwd, projectInfo, options, auth);
  } else {
    // New project
    await setupNewProject(cwd, options, auth);
  }
}

async function setupNewProject(cwd: string, options: GoOptions = {}, auth?: AuthInfo): Promise<void> {
  console.log(chalk.cyan('\n  ━━━ New Project Setup ━━━\n'));

  // Auto-detect non-interactive mode (e.g., running from Claude Code)
  const isNonInteractive = !process.stdin.isTTY;
  if (isNonInteractive && !options.type) {
    console.log(chalk.yellow('  ⚡ Non-interactive mode detected - using defaults\n'));
    options.type = 'personal';
    options.describe = options.describe || 'chat';
    options.skipReview = true;
  }

  let projectType: string;
  let projectName: string;
  const defaultName = cwd.split(/[\\/]/).pop() || 'my-project';

  // Use flags if provided (non-interactive mode for AI)
  if (options.type) {
    projectType = options.type;
    projectName = options.name || defaultName;
    console.log(chalk.green(`  Using: ${projectType.toUpperCase()} project named "${projectName}"\n`));
  } else {
    // Interactive mode - ask questions
    console.log(chalk.white('  What kind of project is this?\n'));
    console.log(chalk.gray('    1. ') + chalk.cyan('PERSONAL') + chalk.gray(' - Just building for myself'));
    console.log(chalk.gray('    2. ') + chalk.cyan('CLIENT') + chalk.gray('   - Building for someone else'));
    console.log(chalk.gray('    3. ') + chalk.cyan('BUSINESS') + chalk.gray(' - My own product/startup\n'));

    let typeChoice = '';
    while (!['1', '2', '3'].includes(typeChoice)) {
      typeChoice = await prompt('  Enter 1, 2, or 3: ');
    }

    const typeMap: Record<string, string> = { '1': 'personal', '2': 'client', '3': 'business' };
    projectType = typeMap[typeChoice];
    projectName = await prompt(`  Project name (${defaultName}): `) || defaultName;
  }

  console.log(chalk.green(`\n  ✓ Setting up "${projectName}" as ${projectType.toUpperCase()} project\n`));

  // Install bootstrap files
  console.log(chalk.white('  Installing CodeBakers...\n'));
  installBootstrapFilesSync(cwd);

  // Create tracking files
  const structure = buildStructureString(cwd);
  createTrackingFiles(cwd, projectName, {}, structure, false);

  // Setup IDEs and MCP
  console.log('');
  setupCursorIDE(cwd);
  setupClaudeCodeMCP(cwd);

  // Update .gitignore
  updateGitignore(cwd);

  // How to describe project
  let describeChoice = '';

  // Use flag if provided (non-interactive mode for AI)
  if (options.describe) {
    const describeMap: Record<string, string> = {
      'guided': '1', 'template': '2', 'paste': '3', 'chat': '4', 'files': '5'
    };
    describeChoice = describeMap[options.describe] || '4';
    console.log(chalk.green(`  Using: ${options.describe} mode for project description\n`));
  } else {
    // Interactive mode
    console.log(chalk.white('\n  📝 How would you like to describe your project?\n'));
    console.log(chalk.gray('    1. ') + chalk.cyan('GUIDED QUESTIONS') + chalk.gray(' - I\'ll ask you step by step'));
    console.log(chalk.gray('    2. ') + chalk.cyan('WRITE A PRD') + chalk.gray('      - Create a blank template to fill out'));
    console.log(chalk.gray('    3. ') + chalk.cyan('PASTE/UPLOAD PRD') + chalk.gray(' - I already have requirements written'));
    console.log(chalk.gray('    4. ') + chalk.cyan('DESCRIBE IN CHAT') + chalk.gray(' - Just tell the AI what you want'));
    console.log(chalk.gray('    5. ') + chalk.cyan('SHARE FILES') + chalk.gray('      - I\'ll share docs/mockups/screenshots\n'));

    while (!['1', '2', '3', '4', '5'].includes(describeChoice)) {
      describeChoice = await prompt('  Enter 1-5: ');
    }
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

  // Confirm to server
  if (auth) {
    const apiUrl = getApiUrl();
    confirmDownload(apiUrl, auth, {
      version: '6.12',
      moduleCount: 0,
      cliVersion: getCliVersion(),
      command: 'go',
      projectName,
    }).catch(() => {});
  }
}

async function setupExistingProject(cwd: string, projectInfo: ProjectInfo, options: GoOptions = {}, auth?: AuthInfo): Promise<void> {
  console.log(chalk.cyan('\n  ━━━ Existing Project Detected ━━━\n'));

  // Auto-detect non-interactive mode (e.g., running from Claude Code)
  const isNonInteractive = !process.stdin.isTTY;
  if (isNonInteractive && !options.name) {
    console.log(chalk.yellow('  ⚡ Non-interactive mode detected - using defaults\n'));
    const folderName = cwd.split(/[\\/]/).pop() || 'my-project';
    options.name = folderName;
    options.skipReview = true;
  }

  // Show what was detected
  console.log(chalk.gray('  Found:'));
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
  let projectName: string;
  let reviewChoice: string;

  // Use flags if provided (non-interactive mode for AI)
  if (options.name) {
    projectName = options.name;
    console.log(chalk.green(`\n  Using project name: "${projectName}"\n`));
  } else {
    projectName = await prompt(`\n  Project name (${defaultName}): `) || defaultName;
  }

  // Use skipReview flag or ask
  if (options.skipReview) {
    reviewChoice = '3';
    console.log(chalk.gray('  Skipping code review (--skip-review flag)\n'));
  } else if (options.type) {
    // If running in non-interactive mode, default to skip review
    reviewChoice = '3';
    console.log(chalk.gray('  Skipping code review (non-interactive mode)\n'));
  } else {
    // Interactive mode - ask about code review
    console.log(chalk.white('\n  Want me to review your code and bring it up to CodeBakers standards?\n'));
    console.log(chalk.gray('    1. ') + chalk.cyan('YES, REVIEW & FIX') + chalk.gray(' - Run audit, then auto-fix issues'));
    console.log(chalk.gray('    2. ') + chalk.cyan('REVIEW ONLY') + chalk.gray('      - Just show me the issues'));
    console.log(chalk.gray('    3. ') + chalk.cyan('SKIP') + chalk.gray('             - Just install CodeBakers\n'));

    reviewChoice = '';
    while (!['1', '2', '3'].includes(reviewChoice)) {
      reviewChoice = await prompt('  Enter 1, 2, or 3: ');
    }
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

  // Install files
  console.log(chalk.white('\n  Installing CodeBakers...\n'));
  installBootstrapFilesSync(cwd);

  // Create tracking files with detected stack
  const structure = buildStructureString(cwd);
  createTrackingFiles(cwd, projectName, projectInfo.stack, structure, true, auditScore);

  // Setup IDEs and MCP
  console.log('');
  setupCursorIDE(cwd);
  setupClaudeCodeMCP(cwd);

  // Update .gitignore
  updateGitignore(cwd);

  // Confirm to server
  if (auth) {
    const apiUrl = getApiUrl();
    confirmDownload(apiUrl, auth, {
      version: '6.12',
      moduleCount: 0,
      cliVersion: getCliVersion(),
      command: 'go',
      projectName,
    }).catch(() => {});
  }
}

function installBootstrapFilesSync(cwd: string): void {
  const spinner = ora('  Installing bootstrap files...').start();

  try {
    writeFileSync(join(cwd, 'CLAUDE.md'), V6_CLAUDE_MD);
    // .cursorrules is written by setupCursorIDE

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
