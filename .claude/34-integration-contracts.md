# CROSS-SYSTEM INTEGRATION PATTERNS
# Module: 34-integration-contracts.md
# Purpose: Prevent gaps between interconnected systems (CLI, API, Dashboard, DB)

---

## WHY THIS MODULE EXISTS

This module was created after a comprehensive audit revealed 47 issues caused by:
- Features added to one system without updating others
- No shared contracts between CLI and API
- Missing integration tests
- Incomplete "definition of done"

**USE THIS MODULE** when building any feature that touches multiple systems.

---

## PART 1: SYSTEM BOUNDARY MAP

### CodeBakers System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER JOURNEY                             │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   DASHBOARD   │    │     CLI       │    │   PATTERNS    │
│  (Next.js)    │    │  (Node.js)    │    │  (.claude/)   │
└───────┬───────┘    └───────┬───────┘    └───────────────┘
        │                    │
        │     ┌──────────────┘
        │     │
        ▼     ▼
┌───────────────────────────────────────┐
│              API LAYER                 │
│  /api/team/* (session auth)           │
│  /api/cli/*  (API key auth)           │
│  /api/*      (public or mixed)        │
└───────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│            DATABASE                    │
│  teams, apiKeys, subscriptions...     │
└───────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│        EXTERNAL SERVICES              │
│  Supabase, Vercel, GitHub, Stripe...  │
└───────────────────────────────────────┘
```

---

## PART 2: FEATURE COMPLETENESS CHECKLIST

### Before marking ANY feature complete, verify ALL applicable items:

```markdown
## Feature: [Name]
## Date: [Date]
## Author: [Name]

### 1. Data Layer
- [ ] Database schema updated (if needed)
- [ ] Migration created and tested
- [ ] Types exported from schema

### 2. API Layer
- [ ] Endpoint created/updated
- [ ] Input validation with Zod
- [ ] Error handling complete
- [ ] Rate limiting applied
- [ ] API documentation updated

### 3. Dashboard (if user-facing)
- [ ] UI component created
- [ ] Loading states implemented
- [ ] Error states implemented
- [ ] Empty states implemented
- [ ] Mobile responsive
- [ ] Accessibility checked

### 4. CLI (if CLI-accessible)
- [ ] CLI command/option added
- [ ] Config schema updated (if storing data)
- [ ] Help text updated
- [ ] CLI syncs with server (if shared data)

### 5. Cross-System Sync
- [ ] Dashboard → API → CLI flow tested
- [ ] CLI → API → Dashboard flow tested
- [ ] Offline behavior handled
- [ ] Conflict resolution defined

### 6. Testing
- [ ] Unit tests for new code
- [ ] Integration test for flow
- [ ] E2E test for critical path
- [ ] Manual test completed

### 7. Documentation
- [ ] CLAUDE.md updated (if pattern change)
- [ ] User docs updated
- [ ] API docs updated
- [ ] Changelog entry added

### 8. Definition of Done
- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] PR reviewed
- [ ] Deployed to staging
- [ ] Smoke tested in staging
```

---

## PART 3: API CONTRACT PATTERN

### Define contracts BEFORE implementation

When building a feature that needs API endpoints, define the contract first:

```typescript
/**
 * API CONTRACT: Service Keys
 *
 * This contract defines the shared interface between:
 * - Dashboard (saves keys)
 * - CLI (reads/uses keys)
 * - API (stores/retrieves keys)
 *
 * ALL SYSTEMS must implement this exact interface.
 */

// Canonical list of ALL supported service keys
export const SERVICE_KEYS = [
  'github',
  'supabase',
  'vercel',
  'openai',
  'anthropic',
  'stripe',
  'twilio_sid',
  'twilio_auth',
  'resend',
  'vapi',
  'sentry',
  'cloudinary',
  'pexels',
  'midjourney',
] as const;

export type ServiceKeyName = typeof SERVICE_KEYS[number];

// API Response shape (used by all consumers)
export interface ServiceKeysResponse {
  [K in ServiceKeyName]?: string | null;
}

// Dashboard display shape
export interface ServiceKeyDisplay {
  name: ServiceKeyName;
  configured: boolean;
  masked: string | null;
  cliSupported: boolean;  // Explicitly mark CLI support
}

// CLI storage shape
export interface CLIServiceKey {
  name: ServiceKeyName;
  value: string | null;
  source: 'local' | 'server';
  lastSynced: string | null;
}
```

### Contract Sync Test

```typescript
// tests/contracts/service-keys.test.ts
import { SERVICE_KEYS } from '@/contracts/service-keys';
import { ServiceName } from '@cli/config';

describe('Service Keys Contract', () => {
  test('CLI supports all contract-defined keys', () => {
    // This test FAILS if CLI doesn't support a key in the contract
    const cliKeys = Object.keys(ServiceName);
    for (const key of SERVICE_KEYS) {
      expect(cliKeys).toContain(key);
    }
  });

  test('Dashboard shows all contract-defined keys', () => {
    // This test FAILS if Dashboard doesn't show a key
    const dashboardKeys = getAllServiceKeyInputs(); // from page
    for (const key of SERVICE_KEYS) {
      expect(dashboardKeys).toContain(key);
    }
  });

  test('API returns all contract-defined keys', async () => {
    // This test FAILS if API doesn't return a key
    const response = await fetch('/api/cli/service-keys');
    const data = await response.json();
    for (const key of SERVICE_KEYS) {
      expect(data).toHaveProperty(key);
    }
  });
});
```

---

## PART 4: INTEGRATION TEST PATTERN

### User Flow Integration Tests

Test complete user journeys, not just components:

```typescript
// tests/integration/service-keys-flow.test.ts

describe('Service Keys: Dashboard to CLI Flow', () => {
  test('keys saved in dashboard are available in CLI', async () => {
    // 1. Login to dashboard
    const session = await loginToTestAccount();

    // 2. Save a key via dashboard API
    await fetch('/api/team/service-keys', {
      method: 'POST',
      body: JSON.stringify({ openai: 'sk-test-key-123' }),
    });

    // 3. Simulate CLI sync (using same API key)
    const cliResponse = await fetch('/api/cli/service-keys', {
      headers: { Authorization: `Bearer ${testApiKey}` },
    });
    const cliData = await cliResponse.json();

    // 4. Verify key is available
    expect(cliData.openai).toBe('sk-test-key-123');
  });

  test('CLI writes synced keys to .env.local', async () => {
    // 1. Setup mock project directory
    const projectDir = await createTempProject();

    // 2. Run CLI sync command
    await execAsync(`cd ${projectDir} && npx @codebakers/cli sync-keys`);

    // 3. Verify .env.local contains the key
    const envContent = await fs.readFile(
      path.join(projectDir, '.env.local'),
      'utf-8'
    );
    expect(envContent).toContain('OPENAI_API_KEY=sk-test-key-123');
  });
});
```

### Provisioning Flow Test

```typescript
describe('Provisioning: Complete Flow', () => {
  test('scaffold creates working project', async () => {
    // 1. Create temp directory
    const projectDir = await createTempDir();

    // 2. Run scaffold with test keys
    await execAsync(`cd ${projectDir} && npx @codebakers/cli scaffold`, {
      input: [
        'test-project',      // Project name
        '1',                 // Personal project
        '1',                 // Use server keys
        'y',                 // Provision all
      ].join('\n'),
    });

    // 3. Verify .env.local was created with all keys
    const envExists = await fs.exists(path.join(projectDir, '.env.local'));
    expect(envExists).toBe(true);

    // 4. Verify project can start
    const { stdout } = await execAsync(
      `cd ${projectDir} && npm run build`,
      { timeout: 60000 }
    );
    expect(stdout).not.toContain('error');

    // 5. Verify db:push was mentioned in output (user knows to run it)
    expect(stdout).toContain('npx drizzle-kit db:push');
  });
});
```

---

## PART 5: SYNC STATE MANAGEMENT

### When data exists in multiple places, define sync behavior:

```typescript
/**
 * Service Key Sync Strategy
 *
 * Sources:
 * 1. Server (dashboard-saved keys)
 * 2. Local (CLI-stored keys)
 * 3. Environment (.env.local in project)
 *
 * Priority: Server > Local > Environment
 *
 * Sync Rules:
 * - On `codebakers setup`: Fetch server keys, save to local
 * - On `codebakers scaffold`: Merge server+local, write to .env.local
 * - On key conflict: Warn user, ask which to keep
 * - On new project (client work): Start fresh, don't inherit keys
 */

interface SyncResult {
  source: 'server' | 'local' | 'env';
  key: ServiceKeyName;
  value: string;
  action: 'added' | 'updated' | 'kept' | 'conflict';
}

async function syncServiceKeys(options: {
  preferServer?: boolean;
  forceOverwrite?: boolean;
  projectType?: 'personal' | 'client';
}): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  // Client projects start fresh
  if (options.projectType === 'client') {
    clearAllLocalKeys();
    return results;
  }

  // Fetch server keys
  const serverKeys = await fetchServerKeys();
  const localKeys = getLocalKeys();

  for (const key of SERVICE_KEYS) {
    const serverValue = serverKeys[key];
    const localValue = localKeys[key];

    if (serverValue && localValue && serverValue !== localValue) {
      // Conflict - ask user or use preference
      if (options.forceOverwrite) {
        setLocalKey(key, serverValue);
        results.push({ source: 'server', key, value: serverValue, action: 'updated' });
      } else {
        // Prompt user
        const choice = await promptKeyConflict(key, serverValue, localValue);
        // ... handle choice
      }
    } else if (serverValue && !localValue) {
      setLocalKey(key, serverValue);
      results.push({ source: 'server', key, value: serverValue, action: 'added' });
    } else if (localValue) {
      results.push({ source: 'local', key, value: localValue, action: 'kept' });
    }
  }

  return results;
}
```

---

## PART 6: CHANGE IMPACT ANALYSIS

### Before making changes, identify all affected systems:

```markdown
## Change Impact Template

### Proposed Change
[Describe the change]

### Systems Affected
- [ ] Database schema
- [ ] API endpoints
- [ ] Dashboard UI
- [ ] CLI commands
- [ ] CLI config
- [ ] Pattern modules
- [ ] Documentation
- [ ] Tests

### Specific Files to Update
| System | File | Change Type |
|--------|------|-------------|
| API | /api/cli/service-keys/route.ts | Modify |
| CLI | /cli/src/config.ts | Modify |
| CLI | /cli/src/commands/scaffold.ts | Modify |
| Dash | /app/(dashboard)/settings/page.tsx | Modify |
| Test | /tests/integration/keys.test.ts | Add |

### Backward Compatibility
- [ ] Old CLI versions will still work
- [ ] Old API calls will still work
- [ ] Existing user data preserved
- [ ] Migration path documented

### Rollback Plan
[How to revert if something goes wrong]
```

---

## PART 7: ANTI-PATTERNS TO AVOID

### 1. Dashboard-Only Features
**Bad:** Add 14 keys to dashboard, only sync 3 to CLI
**Good:** Define contract first, implement in ALL systems together

### 2. Silent Failures
**Bad:** Key sync fails silently, user thinks it worked
**Good:** Explicit error messages with recovery steps

### 3. Inconsistent Validation
**Bad:** Dashboard allows any input, CLI requires specific format
**Good:** Shared validation rules in contract

### 4. Orphaned Features
**Bad:** GitHub PAT stored but never used
**Good:** Either implement fully or remove entirely

### 5. Missing Offline Handling
**Bad:** CLI crashes when server unreachable
**Good:** Graceful degradation, use cached data

### 6. Partial Provisioning
**Bad:** GitHub succeeds, Supabase fails, no cleanup
**Good:** Transaction-like behavior with rollback

---

## PART 8: REVIEW CHECKLIST

Before PR approval, reviewer must verify:

```markdown
## Integration Review Checklist

### Contract Compliance
- [ ] All systems use shared type definitions
- [ ] API response matches contract exactly
- [ ] CLI handles all contract-defined values

### Cross-System Testing
- [ ] Dashboard → API → CLI flow manually tested
- [ ] CLI → API → Dashboard flow manually tested
- [ ] Integration tests added for new flows

### Error Handling
- [ ] Errors propagate correctly across systems
- [ ] User sees actionable error messages
- [ ] Recovery steps documented

### Documentation
- [ ] All systems' docs updated
- [ ] Breaking changes noted in changelog
- [ ] Migration guide if needed
```

---

## SUMMARY

1. **Define contracts BEFORE coding** - All systems agree on interface
2. **Complete the checklist** - No feature is done until all boxes checked
3. **Test the full flow** - Not just individual components
4. **Handle sync conflicts** - Multiple sources = potential conflicts
5. **Analyze change impact** - Know what you're touching
6. **Avoid anti-patterns** - Learn from past mistakes
7. **Review integration** - Reviewers check cross-system behavior

---

**This module prevents the 47 issues found in the CodeBakers audit.**
