# Smart Triggers - Proactive Assistance

**Philosophy:** Users shouldn't memorize commands. The AI proactively monitors and suggests.

## After EVERY Completed Action, Check These Triggers:

### 1. Security Review Trigger
**Fire when:** Files containing `auth`, `login`, `password`, `token`, `session`, `payment`, `billing`, `stripe`, `admin`, `role`, `permission` are modified.

**Show:**
```
I noticed you modified authentication/payment code - this is security-sensitive.
Want me to run a quick security review? Auth bugs are costly to fix later.

[Yes, review it] [Skip for now]
```

### 2. Audit Trigger
**Fire when:**
- 5+ features built since last audit
- 30+ days since last audit
- Tests are failing
- Multiple errors in session

**Show:**
```
You've built [N] features since the last code review. A quick audit could
catch architectural drift before it spreads.

Want me to run one? (y/n)
```

### 3. Test Reminder Trigger
**Fire when:** New .ts/.tsx files created without matching .test. files

**Action:** Auto-add tests (no prompt needed) - this is already mandatory.

### 4. Pre-Deploy Trigger
**Fire when:** `vercel.json`, `.env.production`, `Dockerfile`, or deploy-related files modified.

**Show:**
```
Looks like you're preparing to deploy. Pre-flight check?
- Verify all env vars are set
- Run the full test suite
- Check for console.logs and TODOs
- Validate build succeeds

[Run Pre-Deploy Check] [I'll deploy manually]
```

### 5. Expert Review Trigger
**Fire when:** 100+ lines added OR 5+ files changed in one feature.

**Show:**
```
That was a substantial feature (~[N] lines). A CTO review could spot
architectural improvements before this pattern spreads.

Want a quick expert review? (y/n)
```

### 6. Accessibility Trigger
**Fire when:** UI component files created/modified (`components/`, `.tsx` with JSX, form elements, buttons, modals).

**Show:**
```
New UI component detected. Want me to run an accessibility check?
WCAG issues are much harder to fix after launch.

[Run a11y Check] [Skip for now]
```

### 7. Dependency Security Trigger
**Fire when:** `package.json` modified, `npm install` run, or weekly check.

**Show:**
```
[N] security vulnerabilities found in dependencies:
- [package@version]: [severity] - [description]

Want me to fix these? I'll update to patched versions.

[Fix Vulnerabilities] [Show Details] [Skip]
```

### 8. Documentation Trigger
**Fire when:** New API route created (`app/api/` or `pages/api/`), especially public endpoints.

**Show:**
```
New API endpoint created: [method] /api/[path]

Want me to generate documentation for this endpoint?
I'll create JSDoc comments and update the API docs.

[Generate Docs] [Skip]
```

### 9. Performance Trigger
**Fire when:** Database queries added (Drizzle `.findMany`, `.findFirst`, raw SQL), or data fetching in components.

**Show:**
```
Database query detected in [file]. A few things to consider:
- Does this need an index?
- Could this cause N+1 queries?
- Should this be cached?

Want me to analyze the query performance? (y/n)
```

## Trigger Display Rules

1. **Max 2 suggestions at once** - Don't overwhelm
2. **Explain the WHY** - Users dismiss what they don't understand
3. **Never block** - Suggestions only, user can always skip
4. **Track responses** - If user dismisses 5+ times, reduce frequency
5. **Conversational tone** - Not robotic command prompts

## Adaptive Learning

After each trigger:
- If user accepts → Increment `triggers.accepted[triggerId]`
- If user skips → Increment `triggers.dismissed[triggerId]`
- If dismissed 5+ times with <2 accepts → Show only 20% of the time

## Implementation

After completing ANY action:

```
1. Build context:
   - What files changed?
   - What areas touched? (auth, payment, api, etc.)
   - How many features since last review?
   - Are tests passing?

2. Check each trigger's conditions

3. If trigger fires:
   - Check adaptive frequency (dismissed too often?)
   - Show suggestion with reasoning
   - Wait for user response
   - Update triggers state in .codebakers.json

4. Continue with user's next request
```
