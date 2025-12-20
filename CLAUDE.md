# CODEBAKERS SMART ROUTER
# Version: 1.0
# This file auto-loads the right patterns based on your request

---

## ⚠️ CRITICAL: READ THIS BEFORE EVERY RESPONSE

You have access to modular pattern files in `.claude/` folder.

**DO NOT answer coding questions from memory alone.**

BEFORE writing ANY code:
1. Read this router
2. Detect what the user is asking for
3. Load the relevant module files
4. THEN respond using those patterns

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

### Pre-Flight Audit
**Keywords:** audit, pre-flight, inspection, checklist, review, quality check, launch readiness, 100-point
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

| Module | Lines | Primary Use |
|--------|-------|-------------|
| 00-core | 2,130 | Standards, types, errors (REQUIRED) |
| 01-database | 650 | Drizzle, queries, migrations |
| 02-auth | 1,240 | Auth, 2FA, OAuth, security |
| 03-api | 1,640 | Routes, validation, rate limits |
| 04-frontend | 1,770 | React, forms, states, i18n |
| 05-payments | 1,570 | Stripe, subscriptions, money |
| 06-integrations | 3,440 | Email, VAPI, files, jobs |
| 07-performance | 710 | Caching, optimization |
| 08-testing | 820 | Tests, CI/CD, monitoring |
| 09-design | 3,200 | UI, accessibility, SEO |
| 10-generators | 2,920 | Scaffolding, templates |
| 11-realtime | 1,940 | WebSockets, notifications |
| 12-saas | 1,270 | Multi-tenant, feature flags |
| 13-mobile | 1,060 | React Native, Expo, mobile |
| 14-ai | 890 | OpenAI, Anthropic, RAG, embeddings |
| 15-research | 520 | Market research, competitive analysis |
| 16-planning | 570 | PRD, roadmap, specs |
| 17-marketing | 790 | Growth, campaigns, messaging |
| 18-launch | 690 | Launch playbook, go-live |
| 19-audit | 450 | Pre-flight checks, 100-point audit |
| 20-operations | 1,330 | Monitoring, runbooks, incidents |
| 21-experts-core | 880 | Backend/frontend/security experts |
| 22-experts-health | 780 | Healthcare, HIPAA compliance |
| 23-experts-finance | 1,090 | Fintech, PCI, banking |
| 24-experts-legal | 2,510 | Legal tech, contracts, privacy |
| 25-experts-industry | 3,530 | Ecommerce, edtech, proptech, etc. |
| 26-analytics | 920 | PostHog, Mixpanel, funnels |
| 27-search | 1,130 | Full-text, Algolia, autocomplete |
| 28-email-design | 800 | HTML emails, MJML, React Email |
| 29-data-viz | 950 | Charts, Recharts, D3, dashboards |
| 30-motion | 880 | Framer Motion, GSAP, animations |
| 31-iconography | 630 | Lucide, Heroicons, SVG icons |
| 32-print | 990 | PDF generation, print stylesheets |

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
