# CodeBakers Coherence System

This document explains how CodeBakers enforces consistency across the codebase using centralized constants, service layers, and automated enforcement.

## Overview

The coherence system ensures:
- **Value Consistency**: Same prices, trial days, module counts everywhere
- **Side Effect Handling**: All data mutations trigger required side effects
- **Automatic Enforcement**: Wrong code can't be deployed

## Centralized Constants

All business values live in one file: `src/lib/constants.ts`

### What's Centralized

```typescript
// Pricing
PRICING.PRO.MONTHLY = 49
PRICING.TEAM.MONTHLY = 149
PRICING.AGENCY.MONTHLY = 349

// Trial
TRIAL.ANONYMOUS_DAYS = 7
TRIAL.EXTENDED_DAYS = 7
TRIAL.TOTAL_DAYS = 14

// Modules
MODULES.COUNT = 40

// Product
PRODUCT.CLI_COMMAND = 'npx @codebakers/cli go'
```

### How to Use

```tsx
// ❌ WRONG - Hardcoded value
<p>Try free for 7 days</p>
<p>Just $49/month</p>

// ✅ CORRECT - Use constants
import { TRIAL, PRICING } from '@/lib/constants';

<p>Try free for {TRIAL.ANONYMOUS_DAYS} days</p>
<p>Just ${PRICING.PRO.MONTHLY}/month</p>
```

### Changing Values

To change a value across the entire app:

1. Edit `src/lib/constants.ts`
2. Update the single value
3. All pages automatically reflect the change

```typescript
// To change Pro price from $49 to $59:
PRICING.PRO.MONTHLY = 59  // That's it!
```

## Service Layer Pattern

All database mutations must go through service classes to ensure side effects are handled.

### Available Services

- `UserService` - User CRUD operations
- `TeamService` - Team management
- `ApiKeyService` - API key generation/validation
- `DashboardService` - Dashboard data
- `EmailService` - Email sending

### How to Use

```typescript
// ❌ WRONG - Direct database operation
await db.insert(users).values({ email, name });

// ✅ CORRECT - Use service layer
await UserService.create({ email, name });
// This automatically:
// - Creates the user record
// - Creates their team
// - Sends welcome email
// - Logs the activity
```

### Creating New Services

When creating a new feature that modifies data:

1. Create a service in `src/services/`
2. Put all related operations in the service
3. Include all side effects in the service methods
4. Use the service from API routes/components

```typescript
// src/services/subscription-service.ts
export class SubscriptionService {
  static async upgrade(teamId: string, plan: string) {
    // Update subscription
    await db.update(teams)
      .set({ subscriptionPlan: plan, subscriptionStatus: 'active' })
      .where(eq(teams.id, teamId));

    // Side effects (all in one place)
    await EmailService.sendUpgradeConfirmation(teamId);
    await AnalyticsService.trackConversion(teamId, plan);
    await SlackService.notifyNewSubscription(teamId, plan);
  }
}
```

## ESLint Rules

Custom ESLint rules enforce the coherence system.

### `codebakers/no-hardcoded-constants`

Blocks hardcoded business values in code.

**Triggers on:**
- Pricing values (49, 149, 349)
- Trial days (7, 14) in trial context
- Module counts (40) in module context
- Price strings ("$49", "$149/mo")

**Allowed in:**
- `src/lib/constants.ts` (definitions)
- Test files

### `codebakers/enforce-service-layer`

Blocks direct database mutations outside service files.

**Triggers on:**
- `db.insert()`
- `db.update()`
- `db.delete()`

**Allowed in:**
- Service files (`*-service.ts`, `*Service.ts`)
- Migration files
- Seed files
- Test files
- Scripts folder

## CI Enforcement

The CI pipeline includes a coherence check job that:

1. Scans for hardcoded values
2. Runs ESLint coherence rules
3. Blocks merge if violations found

### Pipeline Flow

```
Push/PR
  ↓
Lint & Type Check ──┐
Tests ──────────────┼─→ Build
Pattern Compliance ─┤
Coherence Check ────┘
```

## Adding New Constants

When adding a new business value:

1. **Add to constants file:**
   ```typescript
   // src/lib/constants.ts
   export const NEW_FEATURE = {
     LIMIT: 100,
     TIMEOUT: 5000,
   } as const;
   ```

2. **Add type export:**
   ```typescript
   export type NewFeatureLimit = typeof NEW_FEATURE.LIMIT;
   ```

3. **Update ESLint rule (if needed):**
   If the value needs enforcement, add it to the ESLint rule detection.

4. **Use in code:**
   ```typescript
   import { NEW_FEATURE } from '@/lib/constants';
   const limit = NEW_FEATURE.LIMIT;
   ```

## Troubleshooting

### ESLint Error: Hardcoded value detected

**Problem:** You used a raw number instead of a constant.

**Solution:**
```typescript
// Before
const price = 49;

// After
import { PRICING } from '@/lib/constants';
const price = PRICING.PRO.MONTHLY;
```

### ESLint Error: Direct database operation

**Problem:** You're writing to the database without using a service.

**Solution:**
1. Move the operation to a service file
2. Import and call the service instead

### CI Coherence Check Fails

**Problem:** The CI found possible hardcoded values.

**Solution:**
1. Check the CI output for flagged lines
2. Replace with appropriate constants
3. Re-push

## Quick Reference

| Category | Constant | Value |
|----------|----------|-------|
| Pricing | `PRICING.PRO.MONTHLY` | 49 |
| Pricing | `PRICING.TEAM.MONTHLY` | 149 |
| Pricing | `PRICING.AGENCY.MONTHLY` | 349 |
| Trial | `TRIAL.ANONYMOUS_DAYS` | 7 |
| Trial | `TRIAL.EXTENDED_DAYS` | 7 |
| Trial | `TRIAL.TOTAL_DAYS` | 14 |
| Modules | `MODULES.COUNT` | 40 |
| CLI | `PRODUCT.CLI_COMMAND` | npx @codebakers/cli go |
| CLI | `PRODUCT.CLI_EXTEND_COMMAND` | codebakers extend |

## Benefits

1. **Zero Inconsistency**: Change once, update everywhere
2. **No Forgotten Side Effects**: Services handle everything
3. **Automatic Enforcement**: ESLint + CI blocks mistakes
4. **Clear Ownership**: Constants file is single source of truth
5. **Easy Auditing**: Grep constants file to see all values
