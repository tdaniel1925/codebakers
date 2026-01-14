# /AUDIT - Review Code Quality

**Purpose:** Analyze existing code for quality, security, and best practices.

## STEP 1: Discovery Questions (FIRST)

Before scanning, ask these questions to tailor the review:

```
Before I review your project, a few quick questions:

**1. Project Context**
   - What does this app do? (1 sentence)
   - Is this a side project, MVP, or production app?

**2. Main Concerns** (pick 1-2)
   [ ] Security - worried about vulnerabilities
   [ ] Performance - it's slow or might not scale
   [ ] Code Quality - messy code, hard to maintain
   [ ] Production Readiness - preparing to launch
   [ ] Quick Scan - just give me top 5 issues

**3. Team Context**
   - Solo or team? (affects code style recommendations)
   - Timeline: quick fixes or comprehensive overhaul?
```

**If user wants Quick Scan:** Skip remaining questions, scan fast, return top 5 issues only.

## STEP 2: Deep Context Gathering

After discovery, automatically gather:

```
Gathering project context...

✓ Reading README, package.json, .env.example
✓ Scanning for TODO/FIXME/HACK comments
✓ Checking test coverage
✓ Analyzing git history for hot spots
✓ Reviewing ESLint/Prettier config
✓ Running npm audit for vulnerabilities
✓ Checking TypeScript strictness
✓ Scanning for hardcoded secrets
✓ Inventorying API endpoints with auth status
```

### Git Analysis (if git repo)
```bash
# Find hot spots (frequently changed files)
git log --pretty=format: --name-only | sort | uniq -c | sort -rg | head -10

# Find files with many "fix" commits
git log --oneline --all | grep -i "fix" | wc -l

# Recent activity
git log --oneline -20
```

### TODO/FIXME Scan
```bash
grep -r "TODO\|FIXME\|HACK\|XXX\|BUG" --include="*.ts" --include="*.tsx"
```

### Dependency Security Scan
```bash
npm audit --json
```

### TypeScript Strictness Check
- Is `strict: true` enabled in tsconfig?
- Count of `: any` types that should be properly typed
- Missing recommended options

### Environment Variable Audit
- Check if `.env.example` exists
- Scan for hardcoded secrets (API keys, tokens)
- Verify `.env` is in `.gitignore`

### Test Coverage Analysis
- Detect test framework (Playwright, Vitest, Jest)
- Count test files in project

### API Endpoint Inventory
- List all API routes found
- Check each for auth protection patterns
- Flag unprotected endpoints

## STEP 3: Generate Report

```
CodeBakers Audit Report

Scanned: 47 files | 8,200 lines
Focus: [User's selected concerns]

## Hot Spots (Files with Most Churn)
1. src/lib/auth.ts - 23 changes (15 fixes)
2. src/app/api/payments/route.ts - 18 changes
3. src/components/Dashboard.tsx - 12 changes

## Developer Notes Found
- 8 TODOs (3 in auth code)
- 2 FIXMEs (payment edge cases)
- 1 HACK (date formatting workaround)

## Dependency Security
Found **3 vulnerabilities**:
- 1 Critical
- 2 High

## Overall Score: 72/100

### Priority Fixes:
1. [CRITICAL] Fix npm audit vulnerabilities
2. [HIGH] Add rate limiting to send endpoint
3. [HIGH] Fix the 3 TODOs in auth code
4. [MEDIUM] Type the 15 `: any` usages

**Want me to fix these issues?** I'll start with critical ones first.
```
