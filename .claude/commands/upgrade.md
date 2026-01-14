# /UPGRADE - Improve Existing Project

**Purpose:** Upgrade an existing codebase to CodeBakers patterns WITHOUT changing the user's stack.

## Key Principle: PRESERVE THE STACK

**NEVER suggest migrating the user's existing tech choices:**
- If they use Prisma → Keep Prisma, upgrade patterns
- If they use Firebase → Keep Firebase, upgrade patterns
- If they use Material UI → Keep Material UI, upgrade patterns

**ONLY upgrade the code quality within their existing stack.**

## Trigger Detection

Detect intent from phrases like:
- "upgrade this project"
- "improve my code"
- "bring this up to standard"
- "review and fix"
- "make this production ready"

## STEP 1: Discovery Questions

```
Before I upgrade your project, help me understand:

**1. Project Purpose**
   - What does this app do?
   - Who are the users?

**2. Main Pain Points** (what bothers you most?)
   [ ] Security concerns
   [ ] Performance issues
   [ ] Messy/hard to maintain code
   [ ] No tests
   [ ] Ready for production/launch
   [ ] All of the above

**3. Constraints**
   - Quick fixes only, or comprehensive upgrade?
   - Any areas I should NOT touch?

**4. Team**
   - Solo or team?
   - Junior or senior devs?
```

## STEP 2: Deep Context Scan

```
Scanning your project deeply...

✓ Detecting your stack from package.json
✓ Reading README for project context
✓ Scanning for TODO/FIXME comments
✓ Analyzing git history for problem areas
✓ Checking existing test coverage
✓ Reviewing your ESLint/Prettier rules
✓ Running npm audit for vulnerabilities
✓ Checking TypeScript strictness config
✓ Scanning for hardcoded secrets in code
✓ Inventorying API endpoints with auth status
```

## STEP 3: Review Mode Selection

Based on discovery answers, suggest a mode:

```
Based on your answers, I recommend: **Production Readiness Review**

Or pick a different focus:

[ ] Security Audit - Auth, secrets, injections, OWASP top 10
[ ] Performance Review - Bundle size, queries, caching
[ ] Code Quality - Patterns, DRY, complexity, maintainability
[ ] Pre-Launch Checklist - Everything needed for production
[ ] Quick Scan - Top 5 issues only (fastest)
[ ] Comprehensive - All of the above (most thorough)
```

## STEP 4: Upgrade Report

Show:
- Your Stack (keeping as-is)
- Git Hot Spots (most changed files)
- Developer Notes Found
- Test Coverage
- Pattern Upgrades Available
- Fix Developer Notes

## Stack Detection

Scan `package.json` to detect:
- orm: prisma | drizzle | typeorm | mongoose
- auth: next-auth | supabase | clerk | firebase
- ui: shadcn | chakra | mui | radix
- db: postgres | mysql | mongodb | sqlite

**Use their stack's patterns, not CodeBakers defaults.**

## Upgrade Execution

1. **Prioritize by severity:**
   - CRITICAL: Security issues
   - HIGH: Missing error handling, hot spots, no tests
   - MEDIUM: Performance, accessibility, TODOs
   - LOW: Code style, documentation

2. **Start with hot spots**

3. **Work incrementally**

4. **Track in .codebakers.json**
