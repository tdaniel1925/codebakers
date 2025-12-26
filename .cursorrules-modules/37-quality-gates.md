# Code Quality Gates

> Load this module when: Setting up projects, configuring CI/CD, enforcing standards

---

## Quality Gate Overview

Every commit must pass these gates before merge:

```
┌─────────────────────────────────────────────────────────────┐
│  Gate 1: Lint          → No ESLint errors                  │
│  Gate 2: Types         → No TypeScript errors              │
│  Gate 3: Tests         → All tests pass                    │
│  Gate 4: Build         → Production build succeeds         │
│  Gate 5: Security      → No high/critical vulnerabilities  │
└─────────────────────────────────────────────────────────────┘
```

---

## Package.json Scripts

### Required Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "check": "npm run lint && npm run typecheck && npm run test",
    "prepare": "husky"
  }
}
```

### Pre-commit Hook

```bash
# Install husky
npm install -D husky lint-staged
npx husky init

# .husky/pre-commit
npm run lint-staged
```

### Lint-Staged Config

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md}": [
      "prettier --write"
    ]
  }
}
```

---

## ESLint Configuration

### Recommended Config (Next.js)

```javascript
// eslint.config.mjs
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends(
    "next/core-web-vitals",
    "next/typescript"
  ),
  {
    rules: {
      // Enforce explicit return types on functions
      "@typescript-eslint/explicit-function-return-type": "warn",

      // No unused variables
      "@typescript-eslint/no-unused-vars": ["error", {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }],

      // No any type
      "@typescript-eslint/no-explicit-any": "error",

      // Enforce consistent imports
      "import/order": ["error", {
        "groups": ["builtin", "external", "internal", "parent", "sibling"],
        "newlines-between": "always",
        "alphabetize": { "order": "asc" }
      }],

      // No console.log in production code
      "no-console": ["warn", { "allow": ["warn", "error"] }],

      // React hooks rules
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    }
  }
];

export default eslintConfig;
```

### Critical Rules Explained

| Rule | Why |
|------|-----|
| `no-explicit-any` | Prevents type safety bypass |
| `no-unused-vars` | Keeps code clean |
| `explicit-function-return-type` | Documents expected return |
| `react-hooks/exhaustive-deps` | Prevents stale closure bugs |
| `no-console` | No debug logs in production |

---

## TypeScript Configuration

### Strict Mode (Required)

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,

    // Module resolution
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,

    // Output
    "noEmit": true,
    "skipLibCheck": true
  }
}
```

### Key Strict Settings

| Setting | Catches |
|---------|---------|
| `strictNullChecks` | Missing null/undefined handling |
| `noImplicitAny` | Untyped variables |
| `noUncheckedIndexedAccess` | Array access without bounds check |
| `noImplicitReturns` | Missing return statements |

---

## Testing Requirements

### Minimum Coverage

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
      exclude: [
        'node_modules/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types/**',
      ],
    },
  },
});
```

### Test File Requirements

Every feature needs:

```typescript
// feature.test.ts

describe('FeatureName', () => {
  // Happy path
  it('should work with valid input', () => {
    // Test normal operation
  });

  // Edge cases
  it('should handle empty input', () => {
    // Test edge case
  });

  // Error cases
  it('should throw on invalid input', () => {
    // Test error handling
  });
});
```

### Test Types Required

| Type | Coverage | When |
|------|----------|------|
| Unit | 70%+ | Every function |
| Integration | Key flows | API routes, DB operations |
| E2E | Critical paths | Auth, checkout, core features |

---

## Prettier Configuration

### Standard Config

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### Ignore File

```
# .prettierignore
node_modules/
.next/
dist/
coverage/
*.min.js
pnpm-lock.yaml
```

---

## GitHub Actions CI

### Complete Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run typecheck

      - name: Test
        run: npm run test -- --coverage

      - name: Build
        run: npm run build

      - name: Security audit
        run: npm audit --audit-level=high

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

### Branch Protection Rules

Set in GitHub repo settings:

- [x] Require status checks to pass
- [x] Require branches to be up to date
- [x] Required checks: `quality`
- [x] Require conversation resolution
- [x] Require signed commits (optional)

---

## Commit Message Format

### Conventional Commits

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Use For |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation |
| `style` | Formatting (no code change) |
| `refactor` | Code change (no feature/fix) |
| `test` | Adding tests |
| `chore` | Maintenance |

### Examples

```bash
# Good
feat(auth): add Google OAuth login
fix(payments): handle expired cards gracefully
docs(readme): add deployment instructions

# Bad
fixed stuff
update
wip
```

### Enforce with Commitlint

```bash
npm install -D @commitlint/cli @commitlint/config-conventional
```

```javascript
// commitlint.config.js
export default {
  extends: ['@commitlint/config-conventional'],
};
```

```bash
# .husky/commit-msg
npx --no -- commitlint --edit $1
```

---

## Import Organization

### Standard Order

```typescript
// 1. Node built-ins
import { readFile } from 'fs';

// 2. External packages
import { z } from 'zod';
import { eq } from 'drizzle-orm';

// 3. Internal absolute imports
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';

// 4. Relative imports
import { Button } from './Button';
import type { User } from '../types';
```

### Path Aliases

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/lib/*": ["./src/lib/*"]
    }
  }
}
```

---

## File Naming Conventions

### React Components

```
# Components (PascalCase)
Button.tsx
UserProfile.tsx
DashboardLayout.tsx

# Hooks (camelCase with use prefix)
useAuth.ts
useLocalStorage.ts

# Utilities (camelCase)
formatDate.ts
validateEmail.ts

# Constants (SCREAMING_SNAKE or camelCase)
constants.ts  # export const MAX_FILE_SIZE = 5_000_000;
```

### API Routes

```
app/
├── api/
│   ├── users/
│   │   ├── route.ts           # GET /api/users, POST /api/users
│   │   └── [id]/
│   │       └── route.ts       # GET/PATCH/DELETE /api/users/:id
│   └── auth/
│       └── [...nextauth]/
│           └── route.ts       # NextAuth routes
```

---

## Error Handling Standards

### API Route Pattern

```typescript
// app/api/users/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = schema.parse(body);

    const user = await createUser(data);

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Failed to create user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Client-Side Pattern

```typescript
// Always handle loading, error, and success states
const [state, setState] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');
const [error, setError] = useState<string | null>(null);

async function handleSubmit(data: FormData) {
  setState('loading');
  setError(null);

  try {
    await submitForm(data);
    setState('success');
  } catch (e) {
    setState('error');
    setError(e instanceof Error ? e.message : 'Something went wrong');
  }
}
```

---

## Security Scanning

### Dependency Audit

```bash
# Check for vulnerabilities
npm audit

# Auto-fix where possible
npm audit fix

# Check specific severity
npm audit --audit-level=high
```

### Secret Scanning

```bash
# Install gitleaks
brew install gitleaks

# Scan for secrets
gitleaks detect --source . --verbose
```

### Pre-commit Secret Check

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
```

---

## Performance Budgets

### Bundle Size Limits

```javascript
// next.config.js
module.exports = {
  experimental: {
    webpackBuildWorker: true,
  },
  // Enable bundle analyzer
  ...(process.env.ANALYZE && {
    webpack(config) {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
        })
      );
      return config;
    },
  }),
};
```

### Target Sizes

| Asset Type | Target | Max |
|------------|--------|-----|
| JS (initial) | < 100KB | 200KB |
| CSS (initial) | < 50KB | 100KB |
| Images | < 200KB each | 500KB |
| Total page weight | < 1MB | 2MB |

---

## Quality Checklist

Before every PR:

```
□ npm run lint passes
□ npm run typecheck passes
□ npm run test passes
□ npm run build succeeds
□ No console.log statements (except error/warn)
□ All new functions have types
□ Complex logic has comments
□ Tests added for new features
□ No TODO/FIXME without issue reference
```
