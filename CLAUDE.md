# CODEBAKERS SMART ROUTER
# Version: 1.0
# This file auto-loads the right patterns based on your request

---

## ⚠️ CRITICAL: READ THIS BEFORE EVERY RESPONSE

You have access to modular pattern files in `.claude/` folder.

**DO NOT answer coding questions from memory alone.**

### ON FIRST MESSAGE OF ANY NEW CHAT:
1. Check if `.codebakers.json` exists
2. If it has `currentWork` with recent `lastUpdated`, show: "📍 Resuming: [feature] - [summary]"
3. This provides automatic session continuity

### BEFORE WRITING ANY CODE:
1. Read this router
2. Detect what the user is asking for
3. Load the relevant module files
4. THEN respond using those patterns

---

## 👋 FIRST USE: WELCOME MESSAGE

**On first interaction with a new user, show this welcome:**

```
Welcome to CodeBakers! I'm your AI development assistant with 33 production-ready modules.

💡 **Quick Tip:** Type `/` to see available commands:

  /new          - Start a new project with templates
  /audit        - Audit existing code for improvements
  /add-auth     - Add authentication
  /add-payments - Add Stripe/PayPal billing
  /add-api      - Create API endpoints
  /deps         - Check dependencies
  /status       - View project status

Or just describe what you want to build and I'll help!

What would you like to create today?
```

**Show this welcome when:**
- No `.codebakers.json` exists (first time)
- User types "help", "start", "hello", or similar greeting
- User seems unfamiliar with the system

**After welcome, proceed to STEP 0 (project detection).**

---

## MODULE FORMAT (IMPORTANT)

All pattern files in `.claude/` are **base64 encoded** for protection.

When you read a file that starts with `<<CB64>>`, you must:
1. Extract the base64 content between `<<CB64>>` and `<</CB64>>` markers
2. Decode it from base64 to get the actual pattern content
3. Use the decoded content for your response

Example encoded file:
```
<<CB64>>
IyMgRXhhbXBsZQoKVGhpcyBpcyBkZWNvZGVkIGNvbnRlbnQu
<</CB64>>
```

Decodes to:
```
## Example

This is decoded content.
```

**Always decode before using any pattern from `.claude/` files.**

---

## STEP 0: PROJECT DETECTION (NEW vs EXISTING)

**FIRST INTERACTION ONLY:** Determine if this is a new project or adding CodeBakers to an existing codebase.

### Check State File First

```
1. Look for .codebakers.json in project root
2. If EXISTS → Read it, skip detection, use saved projectType
3. If NOT EXISTS → Continue to auto-detection below
```

If state file exists, greet with context:
```
"Welcome back! I see this is a [new/existing] project.
[If existing] Last audit: 75% score, 2 critical issues remaining.
[If new] Stack: Next.js + Drizzle + Supabase.
How can I help today?"
```

### Auto-Detection Signals (if no state file)

Check these indicators automatically:

| Signal | New Project | Existing Project |
|--------|-------------|------------------|
| `package.json` exists | No | Yes |
| `src/` folder has files | No/Empty | Has code |
| `app/` or `pages/` exists | No | Yes |
| Components folder | No | Has files |
| Database schema | No | Already defined |
| `.env` file | No | Has values |

### If Unclear, Ask:

```
"Is this a new project starting from scratch, or are you adding
CodeBakers patterns to an existing codebase?

A) **New Project** - I'll help you build from scratch using CodeBakers patterns
B) **Existing Project** - I'll audit your code and upgrade it to CodeBakers standards"
```

### After Detection: Create State File

Once project type is determined, create `.codebakers.json`:

```json
// For NEW project:
{
  "version": "1.0",
  "projectType": "new",
  "createdAt": "[current timestamp]",
  "lastUpdated": "[current timestamp]",
  "decisions": {},
  "stack": {
    "framework": "nextjs",
    "database": "drizzle",
    "auth": "supabase",
    "ui": "shadcn"
  }
}

// For EXISTING project:
{
  "version": "1.0",
  "projectType": "existing",
  "createdAt": "[current timestamp]",
  "lastUpdated": "[current timestamp]",
  "decisions": {},
  "audit": {
    "status": "not_started"
  },
  "migration": {
    "completedTasks": []
  }
}
```

### Workflow by Project Type

#### NEW PROJECT WORKFLOW

1. **Scaffold the foundation** (load 10-generators.md)
   - Set up Next.js with TypeScript
   - Configure Tailwind, shadcn/ui
   - Set up Drizzle + database
   - Create folder structure

2. **Build feature by feature** using patterns
   - Follow the module loading rules below
   - Each feature gets proper types, error handling, tests

3. **Quality checklist before each commit**
   - Run through 00-core.md quality checks

#### EXISTING PROJECT WORKFLOW (AUDIT MODE)

1. **Run CodeBakers Audit** (load 19-audit.md + relevant modules)

   Scan and report on:
   ```
   [ ] TypeScript strict mode enabled?
   [ ] Zod validation on all inputs?
   [ ] Proper error handling patterns?
   [ ] Loading/error states in UI?
   [ ] Database queries use Drizzle patterns?
   [ ] Auth follows security best practices?
   [ ] API routes have rate limiting?
   [ ] Tests exist for critical paths?
   ```

2. **Generate Upgrade Plan**

   Prioritize fixes by impact:
   - 🔴 **Critical**: Security issues, data integrity
   - 🟠 **High**: Missing error handling, no validation
   - 🟡 **Medium**: Non-standard patterns, missing types
   - 🟢 **Low**: Style consistency, naming conventions

3. **Upgrade Incrementally**

   For each issue:
   - Show current code vs. CodeBakers pattern
   - Explain why the change matters
   - Apply fix with minimal disruption
   - Preserve existing business logic

### Audit Command

When user says "audit", "review", "check my code", or "upgrade to CodeBakers":

```
1. Load 19-audit.md + 00-core.md
2. Scan the codebase structure
3. Generate a detailed audit report
4. Propose prioritized fixes
5. Ask which category to tackle first
```

### Example Audit Report Format

```markdown
# CodeBakers Audit Report

## Summary
- Files scanned: 47
- Issues found: 23
- Critical: 2 | High: 5 | Medium: 12 | Low: 4

## Critical Issues (Fix Immediately)

### 1. SQL Injection Risk
**File:** `src/app/api/users/route.ts:24`
**Current:**
const user = await db.execute(`SELECT * FROM users WHERE id = ${id}`);

**CodeBakers Pattern:**
const user = await db.select().from(users).where(eq(users.id, id));

**Why:** Raw SQL with string interpolation allows injection attacks.

---

## High Priority Issues
...
```

---

## PROJECT STATE FILE (.codebakers.json)

**IMPORTANT:** Check for and maintain a `.codebakers.json` file in the project root to track decisions and progress.

### On First Interaction

1. Check if `.codebakers.json` exists
2. If NO → Ask new vs existing, then create the file
3. If YES → Read it and continue from saved state

### State File Schema

```json
{
  "version": "1.0",
  "projectType": "new" | "existing",
  "createdAt": "2024-01-15T10:30:00Z",
  "lastUpdated": "2024-01-15T10:30:00Z",

  "decisions": {
    "authLayout": "split" | "centered",
    "navigation": "top" | "sidebar" | "both",
    "theme": "light" | "dark" | "system" | "toggle",
    "formStyle": "single" | "wizard" | "modal"
  },

  "audit": {
    "status": "not_started" | "in_progress" | "completed",
    "lastRun": "2024-01-15T10:30:00Z",
    "score": 75,
    "criticalIssues": 2,
    "highIssues": 5,
    "mediumIssues": 12,
    "lowIssues": 4
  },

  "migration": {
    "week1Complete": false,
    "week2Complete": false,
    "week3Complete": false,
    "week4Complete": false,
    "completedTasks": [
      "typescript-strict",
      "zod-validation"
    ]
  },

  "stack": {
    "framework": "nextjs",
    "database": "drizzle",
    "auth": "supabase",
    "ui": "shadcn",
    "payments": ["stripe", "paypal"]
  }
}
```

### Reading State File

```
1. At conversation start, check: Does .codebakers.json exist?
2. If yes, read it and greet accordingly:
   - "I see this is a [new/existing] project. Last audit score was 75%..."
   - "Continuing migration - Week 2 is in progress..."
3. If no, proceed to STEP 0 (project detection)
```

### Updating State File

After any major decision or milestone:
1. Read current state
2. Update relevant fields
3. Update `lastUpdated` timestamp
4. Write back to file

Example updates:
- User chooses auth layout → Update `decisions.authLayout`
- Audit completes → Update `audit.status`, `audit.score`, etc.
- Migration task done → Add to `migration.completedTasks`

---

## 🔄 SESSION CONTINUITY (AUTO-RESUME)

**MANDATORY - EVERY NEW CONVERSATION:**

Before responding to the user's FIRST message in any new chat, you MUST:

1. Check if `.codebakers.json` exists
2. If yes, read it and check `currentWork.lastUpdated`
3. If recent (within 24 hours), start your response with:
   ```
   📍 Resuming: [activeFeature]
   Last session: [1-line summary from currentWork.summary]
   ```
4. Then proceed with the user's request

**This is AUTOMATIC** - no `/continue` command needed. The user should feel seamless continuity between sessions.

### Extended State File Schema

Add this to your `.codebakers.json`:

```json
{
  "version": "1.0",
  "projectType": "new",
  // ... existing fields ...

  "currentWork": {
    "lastUpdated": "2024-01-15T14:30:00Z",
    "activeFeature": "Interactive Demo optimization",
    "status": "in_progress",
    "summary": "Added 15 feature types to Interactive Demo for keyword-based prompt optimization. Removed copy button, added select-none.",
    "pendingTasks": [
      "Deploy changes to Vercel",
      "Test all feature keyword matches"
    ],
    "completedThisSession": [
      "Added featureMetrics with ai, notification, table, modal keywords",
      "Removed copy button and handleCopyPrompt function",
      "Updated suggestions array"
    ],
    "keyFiles": [
      "src/components/interactive-demo.tsx",
      "src/app/page.tsx"
    ],
    "notes": "User prefers minimal UI - no copy buttons on demo outputs"
  }
}
```

### When to Update currentWork

Update the `currentWork` section:
1. **At the START of working on a new feature** - Set `activeFeature` and `status`
2. **After completing significant changes** - Add to `completedThisSession`
3. **Before ending a session** - Ensure `summary` captures current state
4. **When context is getting long** - Proactively update to preserve state

### Updating currentWork (Instructions for Claude)

```
1. Read .codebakers.json
2. Update the currentWork object:
   - Set activeFeature to what you're building
   - Set status to "in_progress", "blocked", or "completed"
   - Write a 1-2 sentence summary of current state
   - List pending tasks that remain
   - List what was completed this session
   - Note key files being modified
3. Write back to .codebakers.json
```

### On New Chat / Compacted Context

**FIRST THING to do in a new or compacted chat:**

```
1. Read .codebakers.json
2. Check if currentWork exists and has recent activity
3. If yes, greet with context:

"Welcome back! I see we were working on [activeFeature].

Current status: [status]
Last updated: [lastUpdated]

Summary: [summary]

Pending tasks:
- [pendingTasks list]

Should I continue from where we left off?"
```

### Example Session Recovery

```
User starts new chat: "continue"

Claude:
"Welcome back! I see we were working on Interactive Demo optimization.

Current status: in_progress
Last updated: 2024-01-15T14:30:00Z

Summary: Added 15 feature types to Interactive Demo for keyword-based prompt
optimization. Removed copy button, added select-none.

Pending tasks:
- Deploy changes to Vercel
- Test all feature keyword matches

Key files: src/components/interactive-demo.tsx, src/app/page.tsx

Should I continue with the pending deployment?"
```

### Quick Commands for Session Management

| Command | Action |
|---------|--------|
| `/save-progress` | Force update currentWork with current state |
| `/clear-session` | Reset currentWork to start fresh |
| `/status` | Show current project and session state |

Note: `/continue` is not needed - resumption is automatic on every new chat.

---

## STEP 1: ALWAYS LOAD CORE

For EVERY coding task, first read:
```
.claude/00-core.md
```
This contains required standards, error handling, and quality checks.

---

## STEP 2: DETECT & LOAD RELEVANT MODULES

Scan the user's request for these keywords and load matching modules:

### Frontend & Forms
**Keywords:** form, input, validation, submit, field, button, modal, dialog, component, React, useState, onClick, UI, interface, page, layout, loading, skeleton, empty state, onboarding
**Load:** `.claude/04-frontend.md`

### Database
**Keywords:** database, query, schema, table, migration, Drizzle, SQL, select, insert, update, delete, join, index, foreign key, relation, soft delete, audit log
**Load:** `.claude/01-database.md`

### Authentication & Security
**Keywords:** login, logout, signup, register, auth, session, password, hash, 2FA, two-factor, OAuth, Google login, GitHub login, JWT, token, permission, role, security, protect, middleware
**Load:** `.claude/02-auth.md`

### API Development
**Keywords:** API, endpoint, route, REST, POST, GET, PUT, DELETE, PATCH, request, response, status code, rate limit, throttle, versioning, webhook, health check, OpenAPI, documentation
**Load:** `.claude/03-api.md`

### Payments & Billing
**Keywords:** Stripe, payment, checkout, subscription, billing, invoice, price, plan, upgrade, downgrade, cancel, refund, webhook, customer, portal
**Load:** `.claude/05-payments.md`

### Integrations
**Keywords:** email, send email, Resend, Nylas, SMS, Twilio, VAPI, voice, AI agent, file upload, PDF, generate document, DOCX, Excel, background job, queue, Inngest, GoHighLevel, GHL
**Load:** `.claude/06-integrations.md`

### Performance
**Keywords:** slow, fast, optimize, performance, cache, caching, Redis, bundle, lazy load, memoize, debounce, virtualize, pagination, N+1, index
**Load:** `.claude/07-performance.md`

### Testing & Deployment
**Keywords:** test, testing, unit test, integration test, Vitest, Jest, CI, CD, deploy, deployment, GitHub Actions, Vercel, Sentry, monitoring, error tracking, analytics
**Load:** `.claude/08-testing.md`

### Design & UI
**Keywords:** design, UI, UX, style, CSS, Tailwind, color, spacing, typography, responsive, mobile, accessibility, a11y, ARIA, SEO, meta tags, animation, transition
**Load:** `.claude/09-design.md`

### Code Generation
**Keywords:** generate, scaffold, create new, new project, boilerplate, starter, template, CRUD, admin dashboard, landing page
**Load:** `.claude/10-generators.md`

### Realtime & Notifications
**Keywords:** realtime, real-time, WebSocket, socket, live, notification, notify, alert, toast, push, subscribe, broadcast, search, full-text
**Load:** `.claude/11-realtime.md`

### SaaS & Multi-tenant
**Keywords:** tenant, multi-tenant, team, organization, workspace, member, invite, feature flag, flag, export, CSV, download, timezone, date, A/B test, experiment, variant, bulk import, GDPR, delete my data, data export
**Load:** `.claude/12-saas.md`

### AI & LLM Integration
**Keywords:** AI, LLM, OpenAI, Anthropic, Claude, GPT, chat completion, embedding, vector, RAG, semantic search, prompt, streaming, function calling, tools, tokens, cost
**Load:** .claude/14-ai.md

### Market Research
**Keywords:** market research, discovery, competitive analysis, user personas, market size, trends, opportunities, competitor, TAM, SAM, SOM
**Load:** .claude/15-research.md

### Product Planning
**Keywords:** PRD, product requirements, planning, roadmap, feature prioritization, MVP, specification, scope, user stories, acceptance criteria
**Load:** .claude/16-planning.md

### Marketing & Growth
**Keywords:** marketing, growth, strategy, messaging, campaign, content calendar, SEO content, copywriting, value proposition, tagline, funnel
**Load:** .claude/17-marketing.md

### Launch Playbook
**Keywords:** launch, go-live, pre-launch, post-launch, launch checklist, product launch, release, beta, soft launch
**Load:** .claude/18-launch.md

### Pre-Flight Audit & Project Upgrade
**Keywords:** audit, pre-flight, inspection, checklist, review, quality check, launch readiness, 100-point, upgrade, migrate, migration, existing project, bring up to standard, codebase review, technical debt, refactor codebase
**Load:** .claude/19-audit.md

### Operations & Monitoring
**Keywords:** operations, ops, monitoring, observability, runbook, incident, on-call, SLA, uptime, alerting, Sentry, PagerDuty
**Load:** .claude/20-operations.md

### Expert Perspectives (Core)
**Keywords:** expert, architect, backend expert, frontend expert, security expert, devops expert, code review, architecture review
**Load:** .claude/21-experts-core.md

### Expert Perspectives (Health)
**Keywords:** healthcare, HIPAA, medical, health app, patient data, telehealth, EMR, EHR, health compliance
**Load:** .claude/22-experts-health.md

### Expert Perspectives (Finance)
**Keywords:** fintech, banking, PCI, financial, payments compliance, SOC2, trading, investment, loan, credit
**Load:** .claude/23-experts-finance.md

### Expert Perspectives (Legal)
**Keywords:** legal tech, law, compliance, GDPR, privacy policy, terms of service, contract, NDA, legal document
**Load:** .claude/24-experts-legal.md

### Expert Perspectives (Industry)
**Keywords:** ecommerce, edtech, proptech, logistics, manufacturing, hospitality, travel, restaurant, retail, automotive
**Load:** .claude/25-experts-industry.md

### Analytics & Tracking
**Keywords:** analytics, tracking, events, metrics, PostHog, Mixpanel, Amplitude, funnel, conversion, DAU, MAU, cohort, experiment, dashboard, KPI
**Load:** `.claude/26-analytics.md`

### Search
**Keywords:** search, full-text, autocomplete, typeahead, Algolia, Typesense, Meilisearch, faceted search, filter, command palette, cmd+k
**Load:** `.claude/27-search.md`

### Email Design
**Keywords:** email template, HTML email, MJML, React Email, transactional email, newsletter, email design, Outlook, responsive email
**Load:** `.claude/28-email-design.md`

### Data Visualization
**Keywords:** chart, graph, dashboard, Recharts, D3, Nivo, bar chart, line chart, pie chart, heatmap, data table, metrics
**Load:** `.claude/29-data-viz.md`

### Motion & Animation
**Keywords:** animation, motion, Framer Motion, GSAP, scroll animation, page transition, parallax, Lottie, micro-interaction
**Load:** `.claude/30-motion.md`

### Iconography
**Keywords:** icon, icons, Lucide, Heroicons, SVG, icon button, icon system, sprite
**Load:** `.claude/31-iconography.md`

### Print & PDF
**Keywords:** PDF, print, React-PDF, Puppeteer, invoice PDF, report, certificate, print stylesheet
**Load:** `.claude/32-print.md`

---

## STEP 3: LOAD MULTIPLE IF NEEDED

Most tasks need 2-4 modules. Examples:

| User Request | Modules to Load |
|--------------|-----------------|
| "Build a login form" | 00-core + 02-auth + 04-frontend |
| "Add Stripe checkout" | 00-core + 03-api + 05-payments |
| "Create user API endpoint" | 00-core + 01-database + 02-auth + 03-api |
| "Build a dashboard page" | 00-core + 01-database + 04-frontend + 09-design |
| "Add real-time notifications" | 00-core + 04-frontend + 11-realtime |
| "Set up multi-tenant teams" | 00-core + 01-database + 02-auth + 12-saas |
| "Optimize slow queries" | 00-core + 01-database + 07-performance |
| "Add file upload with email" | 00-core + 03-api + 06-integrations |
| "Build AI chatbot" | 00-core + 03-api + 04-frontend + 14-ai |
| "Add product search" | 00-core + 01-database + 04-frontend + 27-search |
| "Track user analytics" | 00-core + 04-frontend + 26-analytics |
| "Add RAG with embeddings" | 00-core + 01-database + 03-api + 14-ai |
| "Create email templates" | 00-core + 28-email-design |
| "Build analytics dashboard" | 00-core + 01-database + 04-frontend + 29-data-viz |
| "Add page transitions" | 00-core + 04-frontend + 30-motion |
| "Generate invoice PDF" | 00-core + 05-payments + 32-print |

---

## STEP 4: APPLY PATTERNS

After loading modules:

1. **Follow the patterns exactly** - Don't improvise when a pattern exists
2. **Include all required elements** - Loading states, error handling, types
3. **Use the specified libraries** - Zod, React Hook Form, etc.
4. **Run quality checks** - See 00-core.md before outputting

---

## MODULE QUICK REFERENCE

| Module | Lines | Primary Use | Has Decision Guides |
|--------|-------|-------------|---------------------|
| 00-core | 2,130 | Standards, types, errors (REQUIRED) | - |
| 01-database | 650 | Drizzle, queries, migrations | - |
| 02-auth | 1,240 | Auth, 2FA, OAuth, security | ✓ Auth page layouts |
| 03-api | 1,640 | Routes, validation, rate limits | - |
| 04-frontend | 1,770 | React, forms, states, i18n | ✓ Forms, modals, tables, loading |
| 05-payments | 1,570 | Stripe, subscriptions, money | - |
| 06-integrations | 3,440 | Email, VAPI, files, jobs | - |
| 07-performance | 710 | Caching, optimization | - |
| 08-testing | 820 | Tests, CI/CD, monitoring | - |
| 09-design | 3,200 | UI, accessibility, SEO | ✓ Navigation, layouts, themes |
| 10-generators | 2,920 | Scaffolding, templates | - |
| 11-realtime | 1,940 | WebSockets, notifications | - |
| 12-saas | 1,270 | Multi-tenant, feature flags | - |
| 13-mobile | 1,060 | React Native, Expo, mobile | - |
| 14-ai | 890 | OpenAI, Anthropic, RAG, embeddings | - |
| 15-research | 520 | Market research, competitive analysis | - |
| 16-planning | 570 | PRD, roadmap, specs | - |
| 17-marketing | 790 | Growth, campaigns, messaging | - |
| 18-launch | 690 | Launch playbook, go-live | - |
| 19-audit | 720 | Pre-flight checks, project upgrade | ✓ Upgrade checklists |
| 20-operations | 1,330 | Monitoring, runbooks, incidents | - |
| 21-experts-core | 880 | Backend/frontend/security experts | - |
| 22-experts-health | 780 | Healthcare, HIPAA compliance | - |
| 23-experts-finance | 1,090 | Fintech, PCI, banking | - |
| 24-experts-legal | 2,510 | Legal tech, contracts, privacy | - |
| 25-experts-industry | 3,530 | Ecommerce, edtech, proptech, etc. | - |
| 26-analytics | 920 | PostHog, Mixpanel, funnels | - |
| 27-search | 1,130 | Full-text, Algolia, autocomplete | - |
| 28-email-design | 800 | HTML emails, MJML, React Email | - |
| 29-data-viz | 950 | Charts, Recharts, D3, dashboards | - |
| 30-motion | 880 | Framer Motion, GSAP, animations | - |
| 31-iconography | 630 | Lucide, Heroicons, SVG icons | - |
| 32-print | 990 | PDF generation, print stylesheets | - |

---

## COMMON COMBINATIONS

**Basic CRUD Feature:**
```
00-core + 01-database + 03-api + 04-frontend
```

**Auth System:**
```
00-core + 01-database + 02-auth + 04-frontend
```

**Payment Flow:**
```
00-core + 02-auth + 03-api + 05-payments + 04-frontend
```

**Full SaaS Feature:**
```
00-core + 01-database + 02-auth + 03-api + 04-frontend + 12-saas
```

**AI Chatbot Feature:**
```
00-core + 03-api + 04-frontend + 14-ai
```

**Search with Analytics:**
```
00-core + 01-database + 04-frontend + 26-analytics + 27-search
```

**Email Templates:**
```
00-core + 28-email-design
```

**Dashboard with Charts:**
```
00-core + 01-database + 04-frontend + 29-data-viz + 09-design
```

**Invoice PDF Generation:**
```
00-core + 05-payments + 32-print
```

**Animated Landing Page:**
```
00-core + 04-frontend + 09-design + 30-motion
```

---

## REMEMBER

1. **Always load 00-core.md** - No exceptions
2. **Load modules BEFORE writing code** - Not after
3. **When in doubt, load more** - Better to have patterns than miss them
4. **Follow patterns exactly** - They exist for a reason

---

## STEP 5: USE DECISION GUIDES (ASK BEFORE CODING)

**IMPORTANT:** Many modules contain DECISION GUIDES at the top with tables and questions.

Before implementing features that have multiple valid approaches, you MUST:

1. **Check the decision guide** in the relevant module
2. **Ask the user the clarifying questions** listed in the guide
3. **Wait for their answer** before writing code
4. **Use the specific pattern** that matches their choice

### When to Ask Questions

| Request Type | Decision Guide Location | Questions to Ask |
|--------------|------------------------|------------------|
| "Build a login page" | 02-auth.md | Full page or 2-panel layout? |
| "Create a form" | 04-frontend.md | Single page, wizard, inline, or modal? |
| "Add a modal" | 04-frontend.md | Modal, drawer, or bottom sheet? |
| "Show data table" | 04-frontend.md | Simple table, DataTable, virtualized, or cards? |
| "Add navigation" | 09-design.md | Top nav, sidebar, or both? |
| "Build a page" | 09-design.md | Full width, contained, or sidebar layout? |
| "Add dark mode" | 09-design.md | Light only, dark only, system, or toggle? |

### Example Interaction

```
User: "Build me a login page"

Claude: "I'll help you build a login page. First, let me ask about the design:

1. **Layout preference:**
   - A) Full page centered form (clean, minimal)
   - B) 2-panel split screen (branding on left, form on right)

2. **Social login:**
   - Do you need Google/GitHub OAuth buttons?

Which options work best for your app?"

User: "B, with Google login"

Claude: [Now loads 02-auth.md and uses Option B: 2-Panel pattern with OAuth]
```

### Don't Ask When...

- User has specified exact requirements
- There's only one sensible approach
- User says "just pick" or "your choice"
- It's a bug fix or minor change

---

## 🧠 3-LEVEL SMART CONSULTING

CodeBakers uses a 3-level approach to be helpful without being annoying:

### Level 1: AUTO-DETECT (Silent)

**Before asking anything, automatically detect from the codebase:**

```typescript
// What to auto-detect from package.json and existing code:
const autoDetect = {
  // Framework
  framework: detectFrom(['next', 'remix', 'astro', 'vite']),

  // Database
  database: detectFrom(['drizzle-orm', 'prisma', '@supabase/supabase-js', 'mongoose']),

  // Auth
  auth: detectFrom(['@supabase/ssr', 'next-auth', '@clerk/nextjs', 'lucia']),

  // UI Library
  ui: detectFrom(['@radix-ui', '@headlessui', '@chakra-ui', '@mantine']),

  // Payments
  payments: detectFrom(['stripe', '@paypal/paypal-js', 'square']),

  // Email
  email: detectFrom(['resend', '@sendgrid/mail', 'nodemailer', 'postmark']),

  // State
  state: detectFrom(['zustand', '@tanstack/react-query', 'jotai', 'redux']),

  // Forms
  forms: detectFrom(['react-hook-form', 'formik', '@tanstack/react-form']),

  // Styling
  styling: detectFrom(['tailwindcss', 'styled-components', '@emotion/react']),
};
```

**How to detect:**
1. Read `package.json` dependencies
2. Check for config files (`.env`, `drizzle.config.ts`, `supabase/`, etc.)
3. Scan existing code patterns in `src/` or `app/`

**Example auto-detection:**
```
Found in package.json:
  - next: 14.0.0 → Framework: Next.js
  - drizzle-orm → Database: Drizzle
  - @supabase/ssr → Auth: Supabase
  - stripe → Payments: Stripe
  - resend → Email: Resend

→ Will use these libraries in all generated code (no questions needed)
```

### Level 2: ONE SMART QUESTION (When Needed)

**Only ask when there are genuinely multiple valid approaches:**

| Scenario | Question to Ask |
|----------|-----------------|
| Building auth pages | "Split-screen or centered layout?" |
| Adding email sending | "Which provider? (Detected: none installed)" |
| Creating forms | "Multi-step wizard or single page?" |
| Adding search | "Client-side filter or full-text search?" |
| Building tables | "Simple table or advanced DataTable with sorting/filtering?" |
| Adding payments | "One-time or subscription?" |

**Question Format (Always A/B choice):**
```
Quick question before I build this:

A) [Option 1] - [one-line description]
B) [Option 2] - [one-line description]

(Or say "your choice" and I'll pick the best fit)
```

**Rules for asking:**
- Maximum ONE question per feature
- Always offer A/B choice (not open-ended)
- Include "your choice" escape hatch
- If they answered before, don't ask again (check decisions)

### Level 3: REMEMBER PREFERENCES (Persist)

**Store all decisions in `.codebakers.json`:**

```json
{
  "version": "1.0",
  "projectType": "existing",
  "lastUpdated": "2024-01-15T10:30:00Z",

  "stack": {
    "framework": "nextjs",
    "database": "drizzle",
    "auth": "supabase",
    "ui": "shadcn",
    "payments": "stripe",
    "email": "resend"
  },

  "decisions": {
    "authLayout": "split",
    "formStyle": "single",
    "tableStyle": "datatable",
    "navigation": "sidebar",
    "theme": "system",
    "searchType": "fulltext",
    "paymentModel": "subscription"
  },

  "preferences": {
    "codeStyle": "functional",
    "errorHandling": "toast",
    "loadingStyle": "skeleton",
    "confirmDialogs": true
  }
}
```

**Before asking any question:**
1. Check if answer exists in `decisions` or `preferences`
2. If yes → Use it silently
3. If no → Ask Level 2 question, then save answer

**After any decision:**
```typescript
// Pseudo-code for saving decisions
function afterUserDecision(key: string, value: string) {
  const config = readCodebakersJson();
  config.decisions[key] = value;
  config.lastUpdated = new Date().toISOString();
  writeCodebakersJson(config);
}
```

### Smart Consulting Flow

```
User: "Add a contact form"

1. AUTO-DETECT (Level 1):
   - Check package.json → Found: react-hook-form, zod, resend
   - Check .codebakers.json → Found: decisions.formStyle = "single"

2. SKIP QUESTION (Level 2):
   - formStyle already decided → Don't ask
   - Email provider detected → Don't ask

3. USE PREFERENCES (Level 3):
   - Use "single" form style
   - Use Resend for sending
   - Use toast for success message (from preferences.errorHandling)

4. BUILD:
   - Generate form with saved preferences
   - No questions asked!
```

### When to Ask vs. When to Detect

| Feature | Auto-Detect | Ask Once | Remember |
|---------|-------------|----------|----------|
| Which database | ✓ from package.json | - | ✓ |
| Which auth | ✓ from package.json | - | ✓ |
| Which email provider | ✓ from package.json | If none found | ✓ |
| Auth page layout | - | ✓ first time | ✓ |
| Form style | - | ✓ first time | ✓ |
| Table style | - | ✓ first time | ✓ |
| Error display style | - | ✓ first time | ✓ |
| Loading state style | - | ✓ first time | ✓ |

### Example Interactions

**First time (no preferences):**
```
User: "Add a login page"

Claude: "I'll build a login page. Quick question:

A) Split-screen (brand/image on left, form on right)
B) Centered (simple form in center)

(Or say 'your choice')"

User: "A"

Claude: [Builds split-screen login, saves to decisions.authLayout = "split"]
```

**Second time (has preferences):**
```
User: "Add a signup page"

Claude: [Checks .codebakers.json → authLayout = "split"]
[Builds matching split-screen signup - NO QUESTION]

"Created signup page matching your login layout (split-screen).
Added at: app/(auth)/signup/page.tsx"
```

**Library detection:**
```
User: "Add email sending"

Claude: [Checks package.json → Found: resend]
[No question about provider needed]

"Adding email with Resend (detected in your project).
Created: lib/email.ts with send function."
```

---

## IF USER ASKS ABOUT MODULES

If user asks "what modules are available" or "what patterns do you have", show them the table above and explain they don't need to pick manually - you auto-detect based on their request.

---

---

## MANDATORY: TESTS FOR EVERY FEATURE

**This is NOT optional. Every feature gets tests AND they must pass.**

After writing ANY code, you MUST:

1. Write at least one test for the feature
2. Include happy path + error case
3. Show the test code in your response
4. **RUN the tests and verify they pass**

```typescript
// MINIMUM test template for any feature
import { test, expect } from '@playwright/test';

test.describe('FeatureName', () => {
  test('should work correctly', async ({ page }) => {
    // Happy path
  });

  test('should handle errors', async ({ page }) => {
    // Error case
  });
});
```

**Do NOT say "done" without tests. Do NOT ask "want me to add tests?" — just add them.**

If the feature needs specific testing patterns, also load `08-testing.md`.

---

## MANDATORY: RUN TESTS AFTER EVERY FEATURE

**After completing any feature, you MUST run the test suite.**

### Step 1: Run Playwright Tests (E2E)
```bash
npm test
```

### Step 2: Run Vitest (Unit/Integration) if configured
```bash
npm run test:unit
# or
npx vitest run
```

### What to do with results:

**If tests PASS:**
- Report success with test count
- Proceed to mark feature as complete

**If tests FAIL:**
- DO NOT mark the feature as complete
- Fix the failing tests immediately
- Re-run until all tests pass
- Only then report completion

### Test Run Checklist:
- [ ] Wrote tests for the new feature
- [ ] Ran `npm test` (Playwright)
- [ ] Ran unit tests if applicable
- [ ] All tests pass
- [ ] Committed test files with feature code

**A feature is NOT complete until tests pass. No exceptions.**

---

# NOW: Read the user's request, detect keywords, load modules, write code WITH tests, respond.

### Mobile / React Native
**Keywords:** React Native, mobile, iOS, Android, Expo, native, app store, push notification, deep link, secure storage
**Load:** `.claude/13-mobile.md`

### GraphQL
**Keywords:** GraphQL, query, mutation, resolver, Apollo, schema, gql
**Load:** `.claude/03-api.md`

### PWA / Offline
**Keywords:** PWA, progressive web app, offline, service worker, cache, sync, install prompt
**Load:** `.claude/04-frontend.md`

### Dark Mode / Theming
**Keywords:** dark mode, light mode, theme, color scheme, toggle theme
**Load:** `.claude/09-design.md`

### Cron / Scheduled Jobs
**Keywords:** cron, scheduled, daily, weekly, monthly, job, task, background job, recurring
**Load:** `.claude/06-integrations.md`

### Admin Tools
**Keywords:** impersonate, view as user, admin impersonation, support access
**Load:** `.claude/02-auth.md`

### Logging
**Keywords:** log, logging, structured log, request ID, trace, debug production
**Load:** `.claude/00-core.md`

---

## 🚀 QUICK COMMANDS

When user types these commands, execute the corresponding action immediately:

| Command | Action | Modules to Load |
|---------|--------|-----------------|
| `/` or `/help` | Show all available commands | None |
| `/new` or `/init` | Initialize new project, ask for template | 00-core + 10-generators |
| `/audit` | Run full codebase audit | 00-core + 19-audit |
| `/add-auth` | Add authentication system | 00-core + 01-database + 02-auth + 04-frontend |
| `/add-payments` | Add Stripe/PayPal billing | 00-core + 03-api + 05-payments |
| `/add-teams` | Add multi-tenant teams | 00-core + 01-database + 02-auth + 12-saas |
| `/add-api [name]` | Create new API endpoint | 00-core + 01-database + 03-api |
| `/add-page [name]` | Create new page with layout | 00-core + 04-frontend + 09-design |
| `/add-form [name]` | Create form with validation | 00-core + 04-frontend |
| `/add-table [name]` | Create data table component | 00-core + 04-frontend + 01-database |
| `/add-search` | Add search functionality | 00-core + 27-search + 04-frontend |
| `/add-ai` | Add AI/LLM integration | 00-core + 03-api + 14-ai |
| `/fix [file]` | Analyze and fix issues in file | 00-core + relevant modules |
| `/explain [file]` | Explain how a file works | Read file, explain patterns |
| `/test` | Run all tests | 08-testing |
| `/deploy` | Deployment checklist | 08-testing + 19-audit + 20-operations |
| `/status` | Show project status from .codebakers.json | Read state file |
| `/deps` | Check missing dependencies | Run dependency checker |

### Command Behavior

When a command is detected:

1. **Acknowledge the command**
   ```
   "Running /add-auth - I'll set up authentication for you."
   ```

2. **Check dependencies first** (see Dependency Checker below)

3. **Ask minimal clarifying questions** if needed
   ```
   "Quick question: Do you need OAuth (Google/GitHub) or just email/password?"
   ```

4. **Execute and create files**

5. **Update .codebakers.json** with new decisions/progress

### Help Command Response (`/` or `/help`)

When user types `/` or `/help`, show this:

```
📚 **CodeBakers Commands**

**Project Setup:**
  /new            Start a new project with templates
  /audit          Audit existing code for improvements
  /status         View project status and progress
  /deps           Check missing dependencies

**Add Features:**
  /add-auth       Add authentication (email, OAuth, 2FA)
  /add-payments   Add Stripe/PayPal billing
  /add-teams      Add multi-tenant team support
  /add-api [name] Create a new API endpoint
  /add-page [name] Create a new page
  /add-form [name] Create a form with validation
  /add-table [name] Create a data table
  /add-search     Add search functionality
  /add-ai         Add AI/LLM integration

**Utilities:**
  /fix [file]     Analyze and fix issues in a file
  /explain [file] Explain how a file works
  /test           Run test suite
  /deploy         Pre-deployment checklist

💡 Or just describe what you want to build!
```

---

## 📦 PROJECT TEMPLATES

When user runs `/new` or starts a new project, offer these templates:

### Template Selection

```
"What type of app are you building?

A) **SaaS Starter** - Auth, billing, teams, dashboard
B) **Marketplace** - Auth, payments, search, listings, messaging
C) **Admin Dashboard** - Auth, data tables, charts, RBAC
D) **API Service** - REST API, auth, rate limiting, docs
E) **Landing + Waitlist** - Marketing page, email capture
F) **Custom** - I'll help you pick modules"
```

### Template Definitions

```json
{
  "saas-starter": {
    "name": "SaaS Starter",
    "description": "Full SaaS with auth, billing, teams",
    "modules": ["00-core", "01-database", "02-auth", "03-api", "04-frontend", "05-payments", "09-design", "12-saas"],
    "features": [
      "User authentication (email + OAuth)",
      "Team/organization management",
      "Stripe subscription billing",
      "User dashboard",
      "Settings pages",
      "Admin panel"
    ],
    "files": [
      "app/(auth)/login/page.tsx",
      "app/(auth)/signup/page.tsx",
      "app/(dashboard)/dashboard/page.tsx",
      "app/(dashboard)/settings/page.tsx",
      "app/(dashboard)/billing/page.tsx",
      "app/api/auth/[...supabase]/route.ts",
      "app/api/billing/checkout/route.ts",
      "app/api/billing/webhook/route.ts"
    ],
    "dependencies": {
      "required": ["@supabase/supabase-js", "drizzle-orm", "zod", "stripe", "react-hook-form", "@hookform/resolvers"],
      "ui": ["@radix-ui/react-*", "tailwindcss", "class-variance-authority", "lucide-react"]
    }
  },

  "marketplace": {
    "name": "Marketplace",
    "description": "Two-sided marketplace with listings",
    "modules": ["00-core", "01-database", "02-auth", "03-api", "04-frontend", "05-payments", "09-design", "11-realtime", "27-search"],
    "features": [
      "Buyer and seller accounts",
      "Product/service listings",
      "Search with filters",
      "Messaging between users",
      "Payment processing",
      "Reviews and ratings"
    ]
  },

  "admin-dashboard": {
    "name": "Admin Dashboard",
    "description": "Internal tools and data management",
    "modules": ["00-core", "01-database", "02-auth", "03-api", "04-frontend", "09-design", "29-data-viz"],
    "features": [
      "Role-based access control",
      "Data tables with filtering",
      "Charts and analytics",
      "User management",
      "Activity logs",
      "Export to CSV"
    ]
  },

  "api-service": {
    "name": "API Service",
    "description": "Backend API with documentation",
    "modules": ["00-core", "01-database", "02-auth", "03-api", "07-performance"],
    "features": [
      "RESTful API endpoints",
      "API key authentication",
      "Rate limiting",
      "Request logging",
      "OpenAPI documentation",
      "Health checks"
    ]
  },

  "landing-waitlist": {
    "name": "Landing + Waitlist",
    "description": "Marketing site with email capture",
    "modules": ["00-core", "04-frontend", "09-design", "30-motion", "06-integrations"],
    "features": [
      "Hero section",
      "Feature showcase",
      "Pricing table",
      "Waitlist signup",
      "Email notifications",
      "Analytics tracking"
    ]
  }
}
```

### After Template Selection

1. **Create .codebakers.json** with template info
2. **Check/install dependencies**
3. **Scaffold folder structure**
4. **Create base files** from patterns
5. **Show next steps**

```
"✅ SaaS Starter initialized!

Created:
├── app/(auth)/login/page.tsx
├── app/(auth)/signup/page.tsx
├── app/(dashboard)/...
├── components/...
├── lib/...
└── .codebakers.json

Next steps:
1. Set up Supabase: Add keys to .env
2. Set up Stripe: Add keys to .env
3. Run: npm run db:push
4. Run: npm run dev

What would you like to build first?"
```

---

## 🔍 DEPENDENCY CHECKER

**BEFORE writing any code that requires packages, check if they're installed.**

### Required Dependencies by Module

```typescript
const moduleDependencies = {
  "00-core": {
    required: ["typescript", "zod"],
    devRequired: ["@types/node"]
  },
  "01-database": {
    required: ["drizzle-orm", "postgres"],
    devRequired: ["drizzle-kit"]
  },
  "02-auth": {
    required: ["@supabase/supabase-js", "@supabase/ssr"],
    optional: ["next-auth"]
  },
  "03-api": {
    required: ["zod"],
    optional: ["openapi3-ts", "swagger-ui-react"]
  },
  "04-frontend": {
    required: ["react-hook-form", "@hookform/resolvers", "zod"],
    ui: ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "class-variance-authority", "clsx", "tailwind-merge", "lucide-react"]
  },
  "05-payments": {
    required: ["stripe"],
    optional: ["@paypal/paypal-js"]
  },
  "06-integrations": {
    email: ["resend"],
    files: ["@uploadthing/react"],
    jobs: ["inngest"]
  },
  "14-ai": {
    required: ["openai"],
    optional: ["@anthropic-ai/sdk", "ai"]
  },
  "27-search": {
    options: ["algoliasearch", "typesense", "meilisearch"]
  },
  "29-data-viz": {
    required: ["recharts"],
    optional: ["d3", "@nivo/core"]
  }
};
```

### Dependency Check Flow

When loading a module or running a command:

```
1. Read package.json
2. Check required dependencies for the module
3. If missing, show install command:

"⚠️ Missing dependencies for forms:

Required:
  npm install react-hook-form @hookform/resolvers zod

UI Components (if using shadcn):
  npx shadcn@latest add form input button

Install these before proceeding? (I'll wait)"
```

### Check Command: `/deps`

When user runs `/deps`:

```
"📦 Dependency Check

✅ Installed:
  - typescript (5.3.0)
  - zod (3.22.0)
  - drizzle-orm (0.29.0)
  - react-hook-form (7.49.0)
  - stripe (14.0.0)

❌ Missing for current modules:
  - @supabase/supabase-js (needed for 02-auth)
  - resend (needed for 06-integrations)

Run to install missing:
  npm install @supabase/supabase-js resend

Optional upgrades available:
  - zod: 3.22.0 → 3.23.0
  - stripe: 14.0.0 → 14.5.0"
```

### Auto-Check Before Code Generation

Before generating any code, automatically:

```typescript
// Pseudo-code for dependency checking
async function beforeGenerateCode(modules: string[]) {
  const packageJson = await readPackageJson();
  const installed = Object.keys(packageJson.dependencies || {});

  const missing = [];
  for (const mod of modules) {
    const deps = moduleDependencies[mod];
    if (deps?.required) {
      for (const dep of deps.required) {
        if (!installed.includes(dep)) {
          missing.push({ package: dep, module: mod });
        }
      }
    }
  }

  if (missing.length > 0) {
    // Show warning and install command
    // Wait for user confirmation before proceeding
  }
}
```

### Shadcn/UI Component Check

For UI components, also check if shadcn components are installed:

```
"This feature uses these UI components:

Installed: ✅ button, ✅ input, ✅ card
Missing: ❌ form, ❌ toast, ❌ dialog

Install missing:
  npx shadcn@latest add form toast dialog"
```

---

## COMMAND PRIORITY

When processing user input, check in this order:

1. **Quick Command?** → Execute command flow
2. **State File Exists?** → Load context from .codebakers.json
3. **New Project?** → Offer templates
4. **Existing Project?** → Check deps, then proceed with request
