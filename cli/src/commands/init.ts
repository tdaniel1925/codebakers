import chalk from 'chalk';
import ora from 'ora';
import { createInterface } from 'readline';
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { setApiKey, getApiKey, getApiUrl } from '../config.js';

// Enhanced .cursorrules with pre-flight and self-review automation
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

If PROJECT-CONTEXT.md is empty or stale (>7 days), SCAN THE PROJECT FIRST:
- Read package.json for dependencies
- Check src/ structure
- Note existing patterns
- Update PROJECT-CONTEXT.md

### PHASE 3: EXECUTE
- State: \`📋 CodeBakers | [Type] | v6.0 Server-Enforced\`
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

## MULTI-AGENT AWARENESS
- ALWAYS check PROJECT-STATE.md "In Progress" section
- Do NOT duplicate work another agent is doing
- If conflict detected, STOP and ask user

## REMEMBER
- You are a full product team, not just a code assistant
- The modules contain production-tested patterns — USE THEM
- When in doubt, check existing code first
`;

const CURSORIGNORE_TEMPLATE = `# CodeBakers - Files to ignore in Cursor context

# Dependencies
node_modules/
.pnpm-store/
bower_components/

# Build outputs
dist/
build/
.next/
.nuxt/
.output/
out/

# Cache
.cache/
.turbo/
.eslintcache
.prettiercache
*.tsbuildinfo

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment files (don't leak secrets)
.env
.env.local
.env.*.local
.env.production

# IDE
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Test coverage
coverage/
.nyc_output/

# Package locks (large files, not needed for context)
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
    "PRD.md",
    "PROJECT-CONTEXT.md",
    "PROJECT-STATE.md",
    "DECISIONS.md"
  ],
  "cursor.chat.alwaysIncludeRules": true,
  "cursor.composer.alwaysIncludeRules": true,
  "cursor.general.enableAutoImport": true
};

function createPrdTemplate(projectName: string, projectType: string): string {
  const date = new Date().toISOString().split('T')[0];

  const typeSpecificSections = projectType === 'client'
    ? `
## Client Info
- Client Name: [Who is this for?]
- Contact: [Primary contact]
- Deadline: [When is this due?]
- Budget: [If relevant]
`
    : projectType === 'business'
    ? `
## Business Context
- Target Market: [Who are you selling to?]
- Revenue Model: [How does this make money?]
- Competition: [Who are you competing with?]
- MVP Deadline: [When do you need to launch?]
`
    : `
## Personal Goals
- Why am I building this? [Your motivation]
- Learning goals: [What do you want to learn?]
- Time commitment: [Hours per week?]
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
<!-- List the MINIMUM features needed to launch -->
<!-- AI will build these first -->

1. [ ] **Feature 1:** [Description]
   - Acceptance criteria: [How do we know it's done?]

2. [ ] **Feature 2:** [Description]
   - Acceptance criteria: [How do we know it's done?]

3. [ ] **Feature 3:** [Description]
   - Acceptance criteria: [How do we know it's done?]

## Nice-to-Have Features (Post-MVP)
<!-- Features to add after MVP is working -->

1. [ ] [Feature description]
2. [ ] [Feature description]

## Technical Requirements
<!-- AI will use these to make architecture decisions -->

- **Must use:** [Required technologies, APIs, etc.]
- **Must avoid:** [Things you don't want]
- **Performance:** [Any speed/scale requirements?]
- **Security:** [Auth requirements, data sensitivity?]

## User Flows
<!-- Describe the main user journeys -->

### Flow 1: [Name]
1. User does X
2. System responds with Y
3. User sees Z

### Flow 2: [Name]
1. User does X
2. System responds with Y
3. User sees Z

## Data Model (if known)
<!-- Rough idea of main entities -->

- **User:** [fields]
- **[Entity 2]:** [fields]
- **[Entity 3]:** [fields]

## Success Metrics
- [ ] [How will you measure success?]
- [ ] [What does "done" look like?]

## Open Questions
<!-- Things you're unsure about - AI can help clarify -->

1. [Question?]
2. [Question?]

---
<!-- AI INSTRUCTIONS -->
<!-- When building features, reference this PRD -->
<!-- Check off features as they're completed -->
<!-- Add new questions to Open Questions -->
<!-- Update this doc as requirements change -->
`;
}

interface ContentResponse {
  version: string;
  router: string;
  modules: Record<string, string>;
}

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

async function selectProjectType(): Promise<{ type: ProjectType; name: string }> {
  console.log(chalk.white('\n  What kind of project is this?\n'));
  console.log(chalk.gray('    1. ') + chalk.cyan('PERSONAL') + chalk.gray(' - Just building for myself'));
  console.log(chalk.gray('    2. ') + chalk.cyan('CLIENT') + chalk.gray('   - Building for someone else'));
  console.log(chalk.gray('    3. ') + chalk.cyan('BUSINESS') + chalk.gray(' - My own product/startup\n'));

  let typeChoice = '';
  while (!['1', '2', '3'].includes(typeChoice)) {
    typeChoice = await prompt('  Enter 1, 2, or 3: ');
  }

  const typeMap: Record<string, ProjectType> = {
    '1': 'personal',
    '2': 'client',
    '3': 'business'
  };

  const cwd = process.cwd();
  const defaultName = cwd.split(/[\\/]/).pop() || 'my-project';
  const name = await prompt(`  Project name (${defaultName}): `) || defaultName;

  return {
    type: typeMap[typeChoice],
    name
  };
}

function createProjectState(projectName: string, projectType: string): string {
  const date = new Date().toISOString().split('T')[0];
  return `# PROJECT STATE
# Last Updated: ${date}
# Auto-maintained by AI - update when starting/completing tasks

## Project Info
name: ${projectName}
type: ${projectType}
phase: planning

## Current Sprint
Goal: [AI will fill this based on conversation]

## In Progress
<!-- AI: Add tasks here when you START working on them -->
<!-- Format: - [task] (started: date, agent: cursor/claude) -->

## Completed
<!-- AI: Move tasks here when DONE -->
<!-- Format: - [task] (completed: date) -->

## Blockers
<!-- AI: List anything blocking progress -->

## Next Up
<!-- AI: Queue of upcoming tasks -->
`;
}

function createProjectContext(projectName: string, projectType: string): string {
  const date = new Date().toISOString().split('T')[0];
  return `# PROJECT CONTEXT
# Last Scanned: ${date}
# AI: Update this when you first analyze the project or when structure changes significantly

## Overview
name: ${projectName}
type: ${projectType}
description: [AI will fill after scanning]

## Tech Stack
<!-- AI: Fill this by reading package.json and checking file extensions -->
framework:
language:
database:
auth:
styling:
testing:

## Project Structure
<!-- AI: Fill this by scanning the directory structure -->
\`\`\`
[AI will map the project structure here]
\`\`\`

## Key Files
<!-- AI: List the most important files for understanding the project -->
- Entry point:
- Config:
- Database schema:
- API routes:
- Components:

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

### Database Query Pattern
\`\`\`typescript
[AI: Copy an example database query pattern from this project]
\`\`\`

## Environment Variables
<!-- AI: List required env vars (don't include values!) -->
- [ ] DATABASE_URL
- [ ] [others...]

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
- Pattern location (if applicable)

---

## ${date}: Project Initialized
**Decision:** Using CodeBakers v6.0 pattern system
**Reason:** Ensure consistent, production-quality code
**Pattern:** Server-enforced via discover_patterns MCP tool

---

<!-- AI: Add new decisions above this line -->
`;
}

/**
 * Auto-scan project to detect tech stack
 */
function scanProject(cwd: string): { stack: Record<string, string>; structure: string } {
  const stack: Record<string, string> = {};
  let structure = '';

  // Check package.json
  const packageJsonPath = join(cwd, 'package.json');
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      // Detect framework
      if (deps['next']) stack.framework = `Next.js ${deps['next']}`;
      else if (deps['react']) stack.framework = `React ${deps['react']}`;
      else if (deps['vue']) stack.framework = `Vue ${deps['vue']}`;
      else if (deps['express']) stack.framework = `Express ${deps['express']}`;

      // Detect database
      if (deps['drizzle-orm']) stack.database = 'Drizzle ORM';
      else if (deps['prisma']) stack.database = 'Prisma';
      else if (deps['mongoose']) stack.database = 'MongoDB/Mongoose';
      else if (deps['pg']) stack.database = 'PostgreSQL';

      // Detect auth
      if (deps['@supabase/supabase-js']) stack.auth = 'Supabase Auth';
      else if (deps['next-auth']) stack.auth = 'NextAuth.js';
      else if (deps['@clerk/nextjs']) stack.auth = 'Clerk';

      // Detect styling
      if (deps['tailwindcss']) stack.styling = 'Tailwind CSS';
      else if (deps['styled-components']) stack.styling = 'Styled Components';

      // Detect testing
      if (deps['vitest']) stack.testing = 'Vitest';
      else if (deps['jest']) stack.testing = 'Jest';
      else if (deps['@playwright/test']) stack.testing = 'Playwright';

      // Detect language
      if (deps['typescript'] || existsSync(join(cwd, 'tsconfig.json'))) {
        stack.language = 'TypeScript';
      } else {
        stack.language = 'JavaScript';
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Build simple structure
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

    structure = [...dirs.sort(), ...files.sort()].join('\n');
  } catch {
    structure = '[Could not scan structure]';
  }

  return { stack, structure };
}

function updateProjectContextWithScan(contextContent: string, stack: Record<string, string>, structure: string): string {
  let updated = contextContent;

  // Update tech stack
  if (stack.framework) updated = updated.replace('framework: ', `framework: ${stack.framework}`);
  if (stack.language) updated = updated.replace('language: ', `language: ${stack.language}`);
  if (stack.database) updated = updated.replace('database: ', `database: ${stack.database}`);
  if (stack.auth) updated = updated.replace('auth: ', `auth: ${stack.auth}`);
  if (stack.styling) updated = updated.replace('styling: ', `styling: ${stack.styling}`);
  if (stack.testing) updated = updated.replace('testing: ', `testing: ${stack.testing}`);

  // Update structure
  updated = updated.replace(
    '[AI will map the project structure here]',
    structure || '[Empty project]'
  );

  return updated;
}

/**
 * Interactive init command - walks users through complete setup
 */
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

  console.log(chalk.gray('  This wizard will set up CodeBakers in your project.\n'));

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

  // Step 1: Get project type
  const { type: projectType, name: projectName } = await selectProjectType();
  console.log(chalk.green(`\n  ✓ Setting up ${projectName} as ${projectType.toUpperCase()} project\n`));

  // Step 2: Check if already logged in
  let apiKey = getApiKey();

  if (apiKey) {
    console.log(chalk.green('  ✓ Already logged in\n'));
    const useExisting = await confirm('  Use existing API key?');
    if (!useExisting) {
      apiKey = null;
    }
  }

  // Step 3: Login if needed
  if (!apiKey) {
    console.log(chalk.white('\n  Step 1: Get your API key\n'));
    console.log(chalk.gray('  Go to: ') + chalk.cyan('https://codebakers.ai/dashboard'));
    console.log(chalk.gray('  Copy your API key (starts with cb_)\n'));

    apiKey = await prompt('  Paste your API key: ');

    if (!apiKey || !apiKey.startsWith('cb_')) {
      console.log(chalk.red('\n  ✗ Invalid API key. Keys start with "cb_"\n'));
      console.log(chalk.gray('  Get your key at https://codebakers.ai/dashboard\n'));
      process.exit(1);
    }

    const spinner = ora('  Validating API key...').start();

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
      spinner.succeed('API key valid!');
    } catch (error) {
      spinner.fail('Invalid API key');
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.log(chalk.red(`\n  Error: ${message}\n`));
      process.exit(1);
    }
  }

  // Step 4: Install v6.0 bootstrap files
  console.log(chalk.white('\n  Step 2: Installing CodeBakers v6.0\n'));

  const spinner = ora('  Installing v6.0 bootstrap...').start();

  // v6.0 bootstrap content - minimal files, patterns from server
  const V6_CLAUDE_MD = `# CodeBakers v6.0

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

---
*CodeBakers v6.0 - Server-Enforced*
`;

  const V6_CURSORRULES = `# CodeBakers v6.0

MANDATORY: Before writing ANY code, call the discover_patterns MCP tool.

Tool: discover_patterns
Args: { task: "description of what you're building" }

The server returns all patterns, rules, and test requirements.
You cannot write code without calling this tool first.
`;

  try {
    // Write v6.0 bootstrap files
    writeFileSync(join(cwd, 'CLAUDE.md'), V6_CLAUDE_MD);
    writeFileSync(join(cwd, '.cursorrules'), V6_CURSORRULES);

    // Remove old .claude folder if it exists (v5 → v6 migration)
    const claudeDir = join(cwd, '.claude');
    if (existsSync(claudeDir)) {
      const { rmSync } = await import('fs');
      try {
        rmSync(claudeDir, { recursive: true, force: true });
      } catch {
        // Ignore errors
      }
    }

    spinner.succeed('CodeBakers v6.0 installed!');
    console.log(chalk.gray('\n  Patterns are server-enforced via MCP tools'));

  } catch (error) {
    spinner.fail('Installation failed');
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`\n  Error: ${message}\n`));
    process.exit(1);
  }

  // Step 5: Auto-scan project
  console.log(chalk.white('\n  Step 3: Scanning project\n'));

  const scanSpinner = ora('  Analyzing project structure...').start();
  const { stack, structure } = scanProject(cwd);

  const detectedItems = Object.entries(stack).filter(([_, v]) => v).map(([k, v]) => `${k}: ${v}`);
  if (detectedItems.length > 0) {
    scanSpinner.succeed('Project analyzed!');
    console.log(chalk.gray('\n  Detected:'));
    for (const item of detectedItems) {
      console.log(chalk.gray(`    ${item}`));
    }
  } else {
    scanSpinner.succeed('Project scanned (new project detected)');
  }

  // Step 6: Create PROJECT-CONTEXT.md with scan results
  console.log(chalk.white('\n  Step 4: Setting up project files\n'));

  const filesSpinner = ora('  Creating project files...').start();

  try {
    // PROJECT-CONTEXT.md
    let contextContent = createProjectContext(projectName, projectType);
    contextContent = updateProjectContextWithScan(contextContent, stack, structure);
    writeFileSync(join(cwd, 'PROJECT-CONTEXT.md'), contextContent);

    // PROJECT-STATE.md
    const stateContent = createProjectState(projectName, projectType);
    writeFileSync(join(cwd, 'PROJECT-STATE.md'), stateContent);

    // DECISIONS.md
    const decisionsContent = createDecisionsLog(projectName);
    writeFileSync(join(cwd, 'DECISIONS.md'), decisionsContent);

    filesSpinner.succeed('Project files created!');
  } catch (error) {
    filesSpinner.warn('Some project files could not be created');
  }

  // Step 7: Install Cursor files
  console.log(chalk.white('\n  Step 5: Setting up Cursor IDE\n'));

  const cursorSpinner = ora('  Installing Cursor configuration...').start();

  try {
    // Write .cursorrules
    writeFileSync(join(cwd, '.cursorrules'), CURSORRULES_TEMPLATE);

    // Write .cursorignore
    writeFileSync(join(cwd, '.cursorignore'), CURSORIGNORE_TEMPLATE);

    // Create GLOBAL ~/.cursor/mcp.json for MCP server configuration
    // Cursor reads MCP config from global location, not project-local
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

    // Merge with existing MCP config if present
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

    // Create/merge .vscode/settings.json
    const vscodeDir = join(cwd, '.vscode');
    if (!existsSync(vscodeDir)) {
      mkdirSync(vscodeDir, { recursive: true });
    }

    const existingSettingsPath = join(vscodeDir, 'settings.json');

    if (existsSync(existingSettingsPath)) {
      const existing = JSON.parse(readFileSync(existingSettingsPath, 'utf-8'));
      const merged = { ...existing, ...VSCODE_SETTINGS_TEMPLATE };
      writeFileSync(existingSettingsPath, JSON.stringify(merged, null, 2));
    } else {
      writeFileSync(existingSettingsPath, JSON.stringify(VSCODE_SETTINGS_TEMPLATE, null, 2));
    }

    cursorSpinner.succeed('Cursor configuration installed!');
    console.log(chalk.green('    ✓ MCP server configured (~/.cursor/mcp.json)'));
  } catch (error) {
    cursorSpinner.warn('Could not install Cursor files (continuing anyway)');
  }

  // Step 8: Add to .gitignore if not present
  const gitignorePath = join(cwd, '.gitignore');
  if (existsSync(gitignorePath)) {
    const gitignore = readFileSync(gitignorePath, 'utf-8');
    if (!gitignore.includes('.cursorrules')) {
      const additions = '\n# CodeBakers\n.cursorrules\n';
      writeFileSync(gitignorePath, gitignore + additions);
    }
  }

  // Step 9: PRD Setup
  console.log(chalk.white('\n  Step 6: Product Requirements\n'));

  const prdPath = join(cwd, 'PRD.md');
  let prdCreated = false;

  if (existsSync(prdPath)) {
    console.log(chalk.green('  ✓ PRD.md already exists\n'));
    prdCreated = true;
  } else {
    console.log(chalk.gray('  A PRD helps the AI understand what you\'re building.\n'));
    console.log(chalk.white('  How would you like to set up your PRD?\n'));
    console.log(chalk.gray('    0. ') + chalk.magenta('You Decide') + chalk.gray(' - Let AI pick the best option'));
    console.log(chalk.gray('    1. ') + chalk.cyan('CREATE TEMPLATE') + chalk.gray(' - I\'ll fill it out'));
    console.log(chalk.gray('    2. ') + chalk.cyan('PASTE CONTENT') + chalk.gray('   - I have requirements ready'));
    console.log(chalk.gray('    3. ') + chalk.cyan('SKIP FOR NOW') + chalk.gray('    - I\'ll add it later\n'));

    let prdChoice = '';
    while (!['0', '1', '2', '3'].includes(prdChoice)) {
      prdChoice = await prompt('  Enter 0, 1, 2, or 3: ');
    }

    // "You Decide" defaults to creating a template (most helpful)
    if (prdChoice === '0') {
      console.log(chalk.magenta('  → AI chose: Create Template (recommended)\n'));
      prdChoice = '1';
    }

    if (prdChoice === '1') {
      // Create template
      const prdSpinner = ora('  Creating PRD template...').start();
      const prdContent = createPrdTemplate(projectName, projectType);
      writeFileSync(prdPath, prdContent);
      prdSpinner.succeed('PRD template created!');
      console.log(chalk.yellow('\n  → Open PRD.md and fill in your requirements'));
      console.log(chalk.gray('    The AI will use this to understand what to build.\n'));
      prdCreated = true;
    } else if (prdChoice === '2') {
      // Paste content
      console.log(chalk.gray('\n  Paste your PRD content below.'));
      console.log(chalk.gray('  When done, type ') + chalk.cyan('END') + chalk.gray(' on a new line and press Enter.\n'));

      const lines: string[] = [];
      let line = '';

      while (true) {
        line = await prompt('  ');
        if (line.trim().toUpperCase() === 'END') break;
        lines.push(line);
      }

      if (lines.length > 0) {
        const prdSpinner = ora('  Saving PRD...').start();
        const header = `# Product Requirements Document\n# Project: ${projectName}\n# Created: ${new Date().toISOString().split('T')[0]}\n\n`;
        writeFileSync(prdPath, header + lines.join('\n'));
        prdSpinner.succeed('PRD saved!');
        prdCreated = true;
      } else {
        console.log(chalk.yellow('  No content provided, skipping PRD.\n'));
      }
    } else {
      console.log(chalk.gray('\n  You can add PRD.md anytime. The AI will use it automatically.\n'));
    }
  }

  // Success message
  console.log(chalk.green(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   ${chalk.bold('✓ Setup Complete!')}                                    ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
  `));

  console.log(chalk.white('  Files created:\n'));
  console.log(chalk.cyan('    CLAUDE.md          ') + chalk.gray('→ v6.0 bootstrap (patterns via MCP)'));
  console.log(chalk.cyan('    .cursorrules       ') + chalk.gray('→ v6.0 bootstrap (patterns via MCP)'));
  if (prdCreated) {
    console.log(chalk.cyan('    PRD.md             ') + chalk.gray('→ Product requirements (AI reads this!)'));
  }
  console.log(chalk.cyan('    PROJECT-CONTEXT.md ') + chalk.gray('→ Codebase knowledge (auto-updated)'));
  console.log(chalk.cyan('    PROJECT-STATE.md   ') + chalk.gray('→ Task tracking (auto-updated)'));
  console.log(chalk.cyan('    DECISIONS.md       ') + chalk.gray('→ Architecture log (auto-updated)'));
  console.log(chalk.cyan('    .cursorignore      ') + chalk.gray('→ Context optimization\n'));

  console.log(chalk.white('  What happens automatically:\n'));
  console.log(chalk.gray('    ✓ AI loads context before every response'));
  console.log(chalk.gray('    ✓ AI checks for existing patterns to copy'));
  console.log(chalk.gray('    ✓ AI validates code before outputting'));
  console.log(chalk.gray('    ✓ AI updates project state after completing tasks'));
  console.log(chalk.gray('    ✓ AI logs architectural decisions\n'));

  console.log(chalk.white('  For Cursor users:\n'));
  console.log(chalk.gray('    Just open the project and start chatting!\n'));

  console.log(chalk.white('  For Claude Code users:\n'));
  console.log(chalk.cyan('    codebakers install-hook') + chalk.gray('  (one-time setup)\n'));

  console.log(chalk.blue('  Zero friction. Just build.\n'));
}
