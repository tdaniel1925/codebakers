# /BUILD - Create Entire Project

**Purpose:** User has an idea, no code yet. AI plans everything, asks questions, then builds.

## When /build is triggered:

1. **Check if project already exists** (has .codebakers.json with build in progress)
   - If YES: Ask "You have an existing project. Did you mean `/feature` to add something?"
   - If NO: Proceed with /build flow

2. **Start discovery**
   ```
   Starting new project build. Let me understand your vision...
   ```

## STACK CONFIRMATION (FIRST STEP)

**Before asking ANY questions, show the default stack and ask for confirmation:**

```
I'll build this with our production-tested stack:

  Framework:  Next.js 14 (App Router)
  Database:   Supabase (PostgreSQL)
  ORM:        Drizzle
  Auth:       Supabase Auth
  Styling:    Tailwind CSS
  UI:         shadcn/ui
  Forms:      React Hook Form + Zod
  Payments:   Stripe (if needed)

Does this work for you? (yes to continue, or tell me what you'd like to change)
```

**If user says YES (or similar):**
- Skip tech questions entirely
- Go straight to product discovery (users, features, scale)
- Then start building

**If user wants changes:**
- Ask ONLY about the specific layer they want to change
- Show alternatives with "(Recommended)" on the default

## Discovery Phase (AFTER STACK CONFIRMATION)

Once stack is confirmed, ask about the PRODUCT only:

```
Great! Now tell me about your product:

**1. Users & Purpose**
- Who is this for? (consumers, businesses, internal team?)
- What problem does it solve?

**2. Core Features**
- What are the 3-5 must-have features for launch?
- What can wait for v2?

**3. Functionality**
- Will users need accounts?
- Will you charge money? (subscriptions, one-time, free?)
- Real-time features needed? (live updates, chat, notifications)

**4. Scale**
- Web only, or also mobile?
- Expected users at launch?
```

## Research Phase

After discovery, consult relevant expert modules:
- 15-research.md - Market context
- 16-planning.md - Architecture planning
- 21-experts-core.md - Technical review
- [Industry-specific expert if relevant]

## Edge Case Identification

Ask about edge cases:

```
Edge Cases to Consider

Based on your requirements:

1. **Auth Edge Cases**
   - What if user forgets password?
   - Do you need email verification?

2. **Data Edge Cases**
   - What if user deletes their account?
   - Data export requirements (GDPR)?

3. **Payment Edge Cases** (if applicable)
   - Failed payment retry?
   - Refund policy?

Which of these should we include in v1?
```

## PRD Generation

After gathering inputs, generate a complete PRD and save to `.codebakers/prd.md`

## Execution Phase

After user approves:
1. Save PRD to `.codebakers/prd.md`
2. Create build plan in `.codebakers.json`
3. Execute phase by phase, updating progress
4. Run tests after each phase
5. Report progress after each phase completion
